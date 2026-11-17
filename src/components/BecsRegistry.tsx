import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BecsButton as Button, BecsInput as Input, BecsSection as Section } from './BecsControls'
import { purposes } from '../becs/model'
import type { Control, Purpose, Tag } from '../becs/model'
import { checkpointLabels as labels } from '../becs/labels'

const tagStatuses: Record<Tag['status'], string> = {
  DRAFT: '下書き', ACTIVE: '有効', DISABLED: '無効', REPLACED: '交換済み',
}

export default function BecsRegistry({ data, disabled, act }: { data: Control; disabled: boolean; act: (path: string, body?: Record<string, unknown>, method?: string) => void }) {
  const [label, setLabel] = useState('')
  const [placement, setPlacement] = useState('')
  const [purpose, setPurpose] = useState<Purpose>('NFC_WAKE')
  const [deviceType, setDeviceType] = useState('IPHONE')
  const [deviceId, setDeviceId] = useState('')
  const iphones = data.devices.filter(item => item.type === 'IPHONE' && item.status === 'ACTIVE')
  const selectedDeviceId = iphones.some(item => item.device_id === deviceId) ? deviceId : iphones.length === 1 ? iphones[0].device_id : ''

  return <>
    <p><a className="underline" href="/shortcuts/">ショートカットの設定・取得</a></p>
    <Section title="端末台帳">
      <Input label="端末名" value={label} onChange={e => setLabel(e.target.value)} />
      <label className="grid gap-1">端末種別<select className="ui-field rounded p-2" value={deviceType} onChange={e => setDeviceType(e.target.value)}>{['IPHONE', 'MAC', 'ESP32', 'DNS'].map(type => <option key={type}>{type}</option>)}</select></label>
      <Button disabled={disabled || !label.trim()} onClick={() => act('/devices', { label, type: deviceType })}>端末別資格情報を発行</Button>
      {data.devices.map(device => <article className="space-y-2" key={device.device_id}>
        <p>{device.label} / {device.type} / {device.status}</p>
        <p className="break-all">端末ID: <code>{device.device_id}</code></p>
        <div className="flex gap-2">
          <Button disabled={disabled || device.status === 'REVOKED'} onClick={() => act(`/devices/${device.device_id}/revoke`)}>失効</Button>
          <Button disabled={disabled} onClick={() => act(`/devices/${device.device_id}/rotate`)}>資格情報を再発行</Button>
        </div>
      </article>)}
    </Section>
    <Section title="タグ台帳">
      <p>タグを登録し、「有効化」を押してから、登録先iPhoneを選択して「Shortcutsへ紐付け」を押してください。</p>
      <Input label="タグのラベル" value={label} onChange={e => setLabel(e.target.value)} />
      <Input label="設置場所" value={placement} onChange={e => setPlacement(e.target.value)} />
      <label className="grid gap-1">用途<select className="ui-field rounded p-2" value={purpose} onChange={e => setPurpose(e.target.value as Purpose)}>{purposes.map(item => <option key={item} value={item}>{labels[item]}</option>)}</select></label>
      <Button disabled={disabled || !label.trim() || !placement.trim()} onClick={() => act('/nfc/tags', { label, placement, purpose })}>下書きタグを登録</Button>
      <label className="grid gap-1">Shortcuts登録先iPhone<select className="ui-field rounded p-2" value={selectedDeviceId} onChange={e => setDeviceId(e.target.value)}>
        <option value="">端末を選択</option>
        {iphones.map(item => <option key={item.device_id} value={item.device_id}>{item.label} / {item.device_id}</option>)}
      </select></label>
      {!selectedDeviceId && <p>{iphones.length ? '紐付け先のiPhoneを選択してください。' : '端末台帳でiPhoneを登録してください。有効化はiPhone未登録でも実行できます。'}</p>}
      {data.tags.map(tag => {
        const linked = data.bindings.some(item => item.tag_id === tag.tag_id && item.device_id === selectedDeviceId && item.mode === 'IOS_SHORTCUTS' && !item.disabled_at)
        return <article key={tag.tag_id} className="space-y-2 border-t border-white/20 py-3">
          <p>{tag.label} / {tag.placement} / {labels[tag.purpose]} / {tagStatuses[tag.status]}（{tag.status}） / v{tag.version}</p>
          <p className="break-all">タグID: <code>{tag.tag_id}</code></p>
          <p>最後の成功: {tag.last_success_at ?? '未受理'}</p>
          {tag.status === 'DRAFT' && <p>下書きです。ショートカットで使う前に「有効化」を押してください。</p>}
          {tag.status === 'ACTIVE' && !linked && <p>{selectedDeviceId ? '有効化済みです。「Shortcutsへ紐付け」を押してください。' : '有効化済みです。紐付け先のiPhoneを選択してください。'}</p>}
          <Link className="underline" to={`/tap/${tag.tag_id}`}>NDEF確認画面</Link>
          <div className="flex flex-wrap gap-2">
            <Button disabled={disabled || tag.status === 'REPLACED' || !label.trim() || !placement.trim()} onClick={() => act(`/nfc/tags/${tag.tag_id}`, { label, placement, purpose }, 'PATCH')}>入力内容で台帳を更新</Button>
            <Button disabled={disabled || tag.status === 'REPLACED' || tag.status === 'ACTIVE'} onClick={() => act(`/nfc/tags/${tag.tag_id}`, { status: 'ACTIVE' }, 'PATCH')}>有効化</Button>
            <Button disabled={disabled || tag.status === 'REPLACED' || tag.status === 'DISABLED'} onClick={() => act(`/nfc/tags/${tag.tag_id}/disable`)}>無効化</Button>
            <Button disabled={disabled || tag.status === 'REPLACED'} onClick={() => act(`/nfc/tags/${tag.tag_id}/replace`)}>新しいIDへ交換</Button>
            <Button disabled={disabled || !selectedDeviceId || tag.status !== 'ACTIVE' || linked} onClick={() => act('/nfc/bindings', { tag_id: tag.tag_id, device_id: selectedDeviceId, mode: 'IOS_SHORTCUTS' })}>{linked ? 'Shortcuts紐付け済み' : 'Shortcutsへ紐付け'}</Button>
          </div>
          {data.bindings.filter(item => item.tag_id === tag.tag_id).map(binding => <p key={binding.binding_id}>
            {data.devices.find(item => item.device_id === binding.device_id)?.label} / {binding.mode} / {binding.disabled_at ? '停止済み' : '有効'} <Button disabled={disabled || !!binding.disabled_at} onClick={() => act(`/nfc/bindings/${binding.binding_id}`, {}, 'DELETE')}>紐付け停止</Button>
          </p>)}
        </article>
      })}
    </Section>
  </>
}
