import { initialControl } from '../../becs/model.ts'
import type { Control } from '../../becs/model.ts'

export type Db = Pick<D1Database, 'prepare' | 'batch'>
export async function load(db: Db, now: string): Promise<{ sequence: number; control: Control }> {
  const row = await db.prepare('SELECT sequence, document_json FROM becs_snapshots ORDER BY sequence DESC LIMIT 1').first<{ sequence: number; document_json: string }>()
  return row ? { sequence: row.sequence, control: JSON.parse(row.document_json) as Control } : { sequence: 0, control: initialControl(now) }
}
export type Receipt = { id: string; actor: string; fingerprint: string; tag?: string; device?: string; source: string; occurred?: string; now: string; outcome: string; body: unknown; status: number; event: string }
export async function commit(db: Db, sequence: number, control: Control, receipt: Receipt, previous?: Control): Promise<void> {
  const { now } = receipt
  const cutoff = new Date(Date.parse(now) - 90 * 86400_000).toISOString()
  control.sessions = [...control.sessions.filter(item => item.status === 'ACTIVE'), ...control.sessions.filter(item => item.status !== 'ACTIVE' && (item.ended_at ?? now) >= cutoff).slice(-200)]
  control.overrides = control.overrides.filter(item => item.expires_at >= cutoff)
  control.reports = control.reports.slice(-366)
  const statements = [
    // Unique sequence is the compare-and-swap lock. A conflict aborts the entire D1 batch.
    db.prepare('INSERT INTO becs_snapshots(sequence, revision, document_json, derived_at) VALUES(?,?,?,?)').bind(sequence + 1, control.state.revision, JSON.stringify(control), now),
    db.prepare('INSERT INTO nfc_scan_attempts(scan_id,actor_id,fingerprint,tag_id,device_id,source,occurred_at,received_at,outcome,response_json,http_status) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(receipt.id, receipt.actor, receipt.fingerprint, receipt.tag ?? null, receipt.device ?? null, receipt.source, receipt.occurred ?? null, now, receipt.outcome, JSON.stringify(receipt.body), receipt.status),
    db.prepare('INSERT INTO behavior_events(event_id,type,source,scan_id,occurred_at,received_at,payload) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(), receipt.event, receipt.source, receipt.id, receipt.occurred ?? null, now, JSON.stringify(receipt.body)),
  ]
  const changed = <T>(items: T[], old: T[] | undefined, key: keyof T) => items.filter(item => JSON.stringify(item) !== JSON.stringify(old?.find(prior => prior[key] === item[key])))
  for (const tag of changed(control.tags, previous?.tags, 'tag_id')) statements.push(db.prepare('INSERT OR REPLACE INTO nfc_tags VALUES(?,?,?,?,?)').bind(tag.tag_id, tag.purpose, tag.status, tag.version, JSON.stringify(tag)))
  for (const item of changed(control.bindings, previous?.bindings, 'binding_id')) statements.push(db.prepare('INSERT OR REPLACE INTO nfc_bindings VALUES(?,?,?,?,?)').bind(item.binding_id, item.tag_id, item.device_id, item.disabled_at ?? null, JSON.stringify(item)))
  for (const item of changed(control.devices, previous?.devices, 'device_id')) statements.push(db.prepare('INSERT OR REPLACE INTO device_nodes VALUES(?,?,?,?)').bind(item.device_id, item.type, item.status, JSON.stringify({ ...item, token_hash: undefined })))
  for (const item of changed(control.sessions, previous?.sessions, 'id')) statements.push(db.prepare('INSERT OR REPLACE INTO routine_sessions VALUES(?,?,?,?,?)').bind(item.id, item.plan_date, item.kind, item.status, JSON.stringify(item)))
  for (const item of changed(control.commands, previous?.commands, 'command_id')) statements.push(db.prepare('INSERT OR REPLACE INTO device_commands VALUES(?,?,?,?,?)').bind(item.command_id, item.device_id, item.policy_revision, item.status, JSON.stringify(item)))
  for (const item of changed(control.overrides, previous?.overrides, 'id')) statements.push(db.prepare('INSERT OR REPLACE INTO override_sessions VALUES(?,?,?)').bind(item.id, item.expires_at, JSON.stringify(item)))
  statements.push(db.prepare('INSERT OR REPLACE INTO daily_plans(local_date,record_json) VALUES(?,?)').bind(control.state.planDate, JSON.stringify({ state: control.state, tomorrowTop3: control.tomorrowTop3, review: control.review })))
  if (receipt.event.startsWith('NFC_CHECKPOINT_')) statements.splice(2, 0, db.prepare('INSERT INTO behavior_events(event_id,type,source,scan_id,occurred_at,received_at,payload) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(), 'NFC_SCAN_RECEIVED', receipt.source, receipt.id, receipt.occurred ?? null, now, JSON.stringify({ tag_id: receipt.tag, device_id: receipt.device })))
  if (receipt.event === '/privacy/history') {
    statements.push(db.prepare('DELETE FROM becs_snapshots WHERE sequence < ?').bind(sequence + 1))
    statements.push(db.prepare('DELETE FROM nfc_scan_attempts WHERE scan_id <> ?').bind(receipt.id))
    statements.push(db.prepare('DELETE FROM behavior_events WHERE scan_id <> ?').bind(receipt.id))
    for (const table of ['routine_sessions', 'override_sessions', 'device_commands', 'daily_plans']) statements.push(db.prepare(`DELETE FROM ${table}`))
  }
  statements.push(db.prepare("DELETE FROM becs_snapshots WHERE sequence < ? AND sequence NOT IN (SELECT MAX(sequence) FROM becs_snapshots GROUP BY substr(derived_at,1,10))").bind(sequence + 1))
  await db.batch(statements)
}
export async function cleanup(db: Db, now: string): Promise<void> {
  const cutoff = new Date(Date.parse(now) - 90 * 86400_000).toISOString()
  await db.batch([
    db.prepare('DELETE FROM nfc_scan_attempts WHERE received_at < ?').bind(cutoff),
    db.prepare('DELETE FROM behavior_events WHERE received_at < ?').bind(cutoff),
    db.prepare("DELETE FROM routine_sessions WHERE json_extract(record_json,'$.ended_at') < ?").bind(cutoff),
    db.prepare("DELETE FROM device_commands WHERE json_extract(record_json,'$.policy.expires_at') < ?").bind(cutoff),
    db.prepare('DELETE FROM override_sessions WHERE expires_at < ?').bind(cutoff),
    db.prepare('DELETE FROM becs_web_sessions WHERE expires_at < ?').bind(now),
    db.prepare('DELETE FROM becs_login_limits WHERE expires_at < ?').bind(now),
    db.prepare('DELETE FROM becs_snapshots WHERE sequence < (SELECT MAX(sequence) FROM becs_snapshots) AND derived_at < ?').bind(cutoff),
  ])
}
