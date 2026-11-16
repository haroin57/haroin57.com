import { localDate } from './model.ts'
import type { Control, Policy } from './model.ts'

// Promotion beyond OBSERVE requires device-specific recovery and essential-access tests.
export function effectivePolicy(control: Control, deviceId: string, now: string, origin: string): Policy {
  const { state } = control
  const override = control.overrides.some(item => !item.ended_at && Date.parse(item.expires_at) > Date.parse(now))
  const relaxed = override || state.restDay || (state.rewardExpiresAt !== undefined && localDate(state.rewardExpiresAt) === localDate(now) && Date.parse(state.rewardExpiresAt) > Date.parse(now))
  return {
    policy_id: `pol-${state.revision}-${deviceId}`, revision: state.revision, device_id: deviceId, level: 'OBSERVE', issued_at: now, expires_at: new Date(Date.parse(now) + 120_000).toISOString(),
    domains: { deny: [], allow_essential: [] }, apps: { discourage: [], terminate_only_if_safe: [] },
    desktop: { open_apps: state.routinePhase === 'RESEARCH' && !relaxed ? ['Visual Studio Code'] : [], ...(state.routinePhase === 'RESEARCH' ? { focus_url: `${origin}/focus` } : {}) },
    bike: { pre_strength_required: !state.restDay, play_when_pedaling: true, viewing_eligible: state.routinePhase === 'EVENING_BIKE' && (state.progress.strengthSetsCompleted >= 3 || state.restDay) },
    override: { allowed: true, local_fallback_required: true }, reason: override ? '本人による解除が有効です。' : state.restDay ? '休養日です。' : '観測モードです。通信・アプリを遮断しません。',
  }
}
export function refreshCommands(control: Control, now: string, origin: string): void {
  for (const command of control.commands) {
    if (command.status === 'PENDING' && (command.policy_revision < control.state.revision || Date.parse(command.policy.expires_at) <= Date.parse(now))) command.status = 'EXPIRED'
  }
  for (const device of control.devices.filter(item => item.status === 'ACTIVE' && item.type !== 'IPHONE')) {
    const policy = effectivePolicy(control, device.device_id, now, origin)
    control.commands.push({ command_id: crypto.randomUUID(), device_id: device.device_id, policy_revision: policy.revision, status: 'PENDING', attempts: 0, policy })
  }
  control.commands = control.commands.slice(-200)
}
