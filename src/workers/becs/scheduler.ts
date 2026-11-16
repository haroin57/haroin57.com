import type { Env } from '../types.ts'
import { load, commit, cleanup } from './store.ts'
import { settleExpiries } from '../../becs/reducer.ts'
import { refreshCommands } from '../../becs/policy.ts'

export async function maintainBecs(env: Env, now = new Date().toISOString()): Promise<void> {
  if (!env.BECS_ADMIN_SECRET) return
  const db = env.HABIT_DB.withSession('first-primary')
  for (let attempt = 0; attempt < 5; attempt++) {
    const { sequence, control } = await load(db, now)
    const previous = structuredClone(control)
    settleExpiries(control, now)
    for (const session of control.sessions.filter(item => item.status === 'ACTIVE' && item.kind === 'FOCUS')) {
      if (Date.parse(now) - Date.parse(session.last_heartbeat_at ?? session.started_at) > 30000) {
        session.status = 'INTERRUPTED'; session.ended_at = now; control.state.focusPhase = 'IDLE'
      }
    }
    if (JSON.stringify(previous.state) !== JSON.stringify(control.state)) { control.state.revision++; control.state.updatedAt = now }
    const needsRenewal = control.devices.some(device => device.status === 'ACTIVE' && device.type !== 'IPHONE' && !control.commands.some(command => command.device_id === device.device_id && command.policy_revision === control.state.revision && command.policy.expires_at > new Date(Date.parse(now) + 45000).toISOString() && command.status !== 'EXPIRED'))
    if (needsRenewal || control.state.revision !== previous.state.revision) refreshCommands(control, now, env.ALLOWED_ORIGIN ?? 'https://haroin57.com')
    if (JSON.stringify(previous) !== JSON.stringify(control)) {
      try {
        await commit(db, sequence, control, { id: crypto.randomUUID(), actor: 'scheduler', fingerprint: 'maintenance', source: 'SCHEDULER', now, outcome: 'ACCEPTED', body: { revision: control.state.revision }, status: 200, event: 'POLICY_MAINTENANCE' }, previous)
      } catch (error) { if (attempt === 4 || !/UNIQUE|constraint/i.test(String(error))) throw error; continue }
    }
    await cleanup(db, now)
    return
  }
}
