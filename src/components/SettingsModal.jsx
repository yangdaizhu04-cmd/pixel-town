import React, { useEffect, useState } from 'react'
import { useApp, hydrate } from '../lib/store.jsx'
import { Modal, Btn, Field, Chip, confirmBox } from './ui.jsx'
import { setMuted, sfx, emit } from '../lib/gamify.js'
import { webdavUpload, webdavDownload, backupFilename } from '../lib/webdav.js'
import { dayKey, daysBetween } from '../lib/dates.js'

const PRESETS = [
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
]

const summarizeSave = (s) => {
  const p = s.profile || {}
  return `Lv.${p.level || '?'} · 金币 ${p.coins ?? '?'} · 连续 ${p.streak ?? '?'} 天 · 待办 ${(s.todos || []).length} 条`
}

export default function SettingsModal({ open, onClose }) {
  const { state, dispatch } = useApp()
  const [form, setForm] = useState(state.settings)
  const [name, setName] = useState(state.profile.name)
  const [height, setHeight] = useState(state.profile.height)
  const [danger, setDanger] = useState(false)
  const [davBusy, setDavBusy] = useState('')

  useEffect(() => {
    if (open) {
      setForm(state.settings)
      setName(state.profile.name)
      setHeight(state.profile.height)
      setDanger(false)
      setDavBusy('')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    dispatch({ type: 'SETTINGS_SET', patch: form })
    dispatch({ type: 'PROFILE_SET', patch: { name: (name || '').trim() || '小镇居民', height: +height || 0 } })
    setMuted(!form.sound)
    sfx('coin')
    onClose()
  }

  // 备份文件里绝不能带密钥：剥掉阿咕 API Key 和 WebDAV 密码再导出（导入时这些留空走离线兜底，无碍）
  const sanitized = () => ({ ...state, settings: { ...state.settings, apiKey: '', webdavPass: '' } })

  const exportData = () => {
    const blob = new Blob([JSON.stringify(sanitized(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pixel-town-backup-${dayKey()}.json`
    a.click()
    URL.revokeObjectURL(url)
    dispatch({ type: 'EXPORT_MARK' })
    emit('toast', { icon: '💾', text: '备份已导出（不含任何密钥），记得存进网盘或手机里' })
  }

  // 导入前先预览存档摘要，确认后才覆盖（旧版是直接覆盖，误选文件会丢数据）
  const importData = (file) => {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const data = hydrate(JSON.parse(reader.result))
        const ok = await confirmBox({
          title: '导入这份存档？',
          message: `这是一位 ${summarizeSave(data)} 的居民存档。\n导入会覆盖当前小镇的全部记录，建议先「导出备份」留底。`,
          danger: true,
          okText: '覆盖导入',
        })
        if (!ok) return
        dispatch({ type: 'IMPORT', state: data })
        sfx('levelup')
        emit('toast', { icon: '📥', text: '存档导入成功，欢迎回家～' })
        onClose()
      } catch {
        emit('toast', { icon: '📎', text: '这个文件不像小镇存档哦，检查一下是不是备份 JSON？' })
        sfx('oops')
      }
    }
    reader.readAsText(file)
  }

  const davUpload = async () => {
    setDavBusy('up')
    try {
      await webdavUpload({ url: form.webdavUrl, user: form.webdavUser, pass: form.webdavPass, content: JSON.stringify(sanitized()), filename: backupFilename() })
      dispatch({ type: 'EXPORT_MARK' })
      emit('toast', { icon: '☁️', text: '已备份到网盘！' })
      sfx('levelup')
    } catch (err) {
      emit('toast', { icon: '☁️', text: `${err.message}（若是 CORS 拦截，说明该网盘不支持浏览器直连，请用「导出备份」）` })
      sfx('oops')
    }
    setDavBusy('')
  }

  const davDownload = async () => {
    setDavBusy('down')
    try {
      const text = await webdavDownload({ url: form.webdavUrl, user: form.webdavUser, pass: form.webdavPass, filename: backupFilename() })
      const data = hydrate(JSON.parse(text))
      const ok = await confirmBox({
        title: '从网盘恢复？',
        message: `网盘上是 Lv.${data.profile.level}、连续 ${data.profile.streak} 天的存档。恢复会覆盖当前小镇记录，确定吗？`,
        danger: true,
        okText: '恢复',
      })
      if (!ok) { setDavBusy(''); return }
      dispatch({ type: 'IMPORT', state: data })
      sfx('levelup')
      emit('toast', { icon: '☁️', text: '已从网盘恢复！' })
      onClose()
    } catch (err) {
      emit('toast', { icon: '☁️', text: err.message })
      sfx('oops')
    }
    setDavBusy('')
  }

  const reset = async () => {
    if (!danger) { setDanger(true); return }
    const ok = await confirmBox({ title: '重置小镇', message: '所有记录都会清空并恢复演示数据，确定要重来吗？', danger: true, okText: '清空重来' })
    if (!ok) { setDanger(false); return }
    dispatch({ type: 'RESET' })
    onClose()
  }

  const lastExport = state.profile.lastExportDay
  const exportHint = !lastExport
    ? '还没有导出过备份。localStorage 一旦被浏览器清理就无法找回，建议每周导出一次～'
    : daysBetween(lastExport, dayKey()) >= 7
      ? `上次备份是 ${daysBetween(lastExport, dayKey())} 天前，花 10 秒导出一份吧？`
      : `上次备份：${lastExport}`

  return (
    <Modal open={open} onClose={onClose} title="小镇设置" wide>
      <div className="settings">
        <section>
          <h4>🏘️ 小镇档案</h4>
          <div className="form-row">
            <Field label="昵称">
              <input value={name} maxLength={10} onChange={(e) => setName(e.target.value)} placeholder="小镇居民" />
            </Field>
            <Field label="身高 cm（算 BMI 用）">
              <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="170" />
            </Field>
            <Field label="天气来源">
              <select value={form.weatherMode || ''} onChange={(e) => setForm({ ...form, weatherMode: e.target.value })}>
                <option value="">小镇预言（不查真实天气）</option>
                <option value="geo">📍 跟随我的定位</option>
                <option value="city">🏙️ 指定城市</option>
              </select>
            </Field>
            {form.weatherMode === 'city' && (
              <Field label="城市名">
                <input value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="比如：杭州" />
              </Field>
            )}
          </div>
          {(form.weatherMode || '') === 'geo' && (
            <p className="settings-hint">📍 浏览器会请求一次定位权限（约 30 分钟复用一次，不会反复打扰）；拒绝或定位失败时自动回退到小镇预言天气。</p>
          )}
        </section>

        <section>
          <h4>🐣 智能体「阿咕」</h4>
          <p className="settings-hint">填入任意 OpenAI 兼容接口的 Key，阿咕就会变成大模型大脑（还流式打字、能帮你记待办和记账）；留空则使用离线小精灵。Key 只保存在你自己的浏览器里。</p>
          <div className="preset-row">
            {PRESETS.map((p) => (
              <Btn
                key={p.name}
                size="sm"
                color={form.baseUrl === p.baseUrl ? 'green' : ''}
                onClick={() => setForm({ ...form, baseUrl: p.baseUrl, model: p.model })}
              >
                {p.name}
              </Btn>
            ))}
          </div>
          <div className="form-row">
            <Field label="接口地址 Base URL">
              <input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.deepseek.com/v1" />
            </Field>
            <Field label="模型名">
              <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="deepseek-chat" />
            </Field>
          </div>
          <Field label="API Key">
            <input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="sk-..." autoComplete="off" />
          </Field>
          <div className="settings-status">
            {form.apiKey ? <Chip color="green">✓ 将使用大模型对话</Chip> : <Chip>离线小精灵模式</Chip>}
          </div>
        </section>

        <section>
          <h4>☁️ 云备份（WebDAV，可选）</h4>
          <p className="settings-hint">填 WebDAV 地址和账号即可一键备份/恢复。坚果云地址形如 https://dav.jianguoyun.com/dav/（密码用「应用密码」）。若浏览器提示 CORS 拦截，说明该网盘不支持网页直连，改用下方手动导出即可。</p>
          <div className="form-row">
            <Field label="WebDAV 地址">
              <input value={form.webdavUrl || ''} onChange={(e) => setForm({ ...form, webdavUrl: e.target.value })} placeholder="https://dav.jianguoyun.com/dav/" />
            </Field>
            <Field label="账号">
              <input value={form.webdavUser || ''} onChange={(e) => setForm({ ...form, webdavUser: e.target.value })} autoComplete="off" />
            </Field>
            <Field label="密码 / 应用密码">
              <input type="password" value={form.webdavPass || ''} onChange={(e) => setForm({ ...form, webdavPass: e.target.value })} autoComplete="off" />
            </Field>
          </div>
          <div className="btn-row">
            <Btn color="blue" disabled={!form.webdavUrl || !form.webdavUser || davBusy === 'up'} onClick={davUpload}>{davBusy === 'up' ? '上传中…' : '☁️ 备份到网盘'}</Btn>
            <Btn disabled={!form.webdavUrl || !form.webdavUser || davBusy === 'down'} onClick={davDownload}>{davBusy === 'down' ? '读取中…' : '☁️ 从网盘恢复'}</Btn>
          </div>
        </section>

        <section>
          <h4>🔔 音效</h4>
          <label className="check-line">
            <input type="checkbox" checked={form.sound} onChange={(e) => setForm({ ...form, sound: e.target.checked })} />
            <span>打开 8-bit 小音效（完成任务、金币入账时）</span>
          </label>
        </section>

        <section>
          <h4>💾 数据（保存在浏览器本地）</h4>
          <p className="settings-hint">{exportHint}</p>
          <div className="btn-row">
            <Btn onClick={exportData}>导出备份</Btn>
            <label className="btn import-label">
              导入备份
              <input type="file" accept="application/json" onChange={(e) => e.target.files[0] && importData(e.target.files[0])} />
            </label>
            <Btn color="red" onClick={reset}>{danger ? '再点一次确认清空！' : '重置小镇'}</Btn>
          </div>
        </section>
      </div>
      <div className="modal-foot">
        <Btn onClick={onClose}>取消</Btn>
        <Btn color="green" onClick={save}>保存</Btn>
      </div>
    </Modal>
  )
}
