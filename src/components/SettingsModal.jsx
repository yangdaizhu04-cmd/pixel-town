import React, { useEffect, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { Modal, Btn, Field, Chip } from './ui.jsx'
import { setMuted, sfx } from '../lib/gamify.js'

const PRESETS = [
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
]

export default function SettingsModal({ open, onClose }) {
  const { state, dispatch } = useApp()
  const [form, setForm] = useState(state.settings)
  const [name, setName] = useState(state.profile.name)
  const [height, setHeight] = useState(state.profile.height)
  const [danger, setDanger] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(state.settings)
      setName(state.profile.name)
      setHeight(state.profile.height)
      setDanger(false)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    dispatch({ type: 'SETTINGS_SET', patch: form })
    dispatch({ type: 'PROFILE_SET', patch: { name: (name || '').trim() || '小镇居民', height: +height || 0 } })
    setMuted(!form.sound)
    sfx('coin')
    onClose()
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pixel-town-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importData = (file) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (!data || !data.profile) throw new Error('bad')
        dispatch({ type: 'IMPORT', state: data })
        sfx('levelup')
        onClose()
      } catch {
        alert('这个文件不像小镇存档哦，检查一下是不是备份 JSON？')
      }
    }
    reader.readAsText(file)
  }

  const reset = () => {
    if (!danger) { setDanger(true); return }
    dispatch({ type: 'RESET' })
    onClose()
  }

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
          </div>
        </section>

        <section>
          <h4>🐣 智能体「阿咕」</h4>
          <p className="settings-hint">填入任意 OpenAI 兼容接口的 Key，阿咕就会变成大模型大脑；留空则使用离线小精灵（能查数据、记待办）。Key 只保存在你自己的浏览器里。</p>
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
          <h4>🔔 音效</h4>
          <label className="check-line">
            <input type="checkbox" checked={form.sound} onChange={(e) => setForm({ ...form, sound: e.target.checked })} />
            <span>打开 8-bit 小音效（完成任务、金币入账时）</span>
          </label>
        </section>

        <section>
          <h4>💾 数据（保存在浏览器本地）</h4>
          <div className="btn-row">
            <Btn onClick={exportData}>导出备份</Btn>
            <label className="btn import-label">
              导入备份
              <input type="file" accept="application/json" onChange={(e) => e.target.files[0] && importData(e.target.files[0])} />
            </label>
            <Btn color="red" onClick={reset}>{danger ? '再点一次确认清空！' : '重置小镇'}</Btn>
          </div>
          <p className="settings-hint">重置会清空所有记录并恢复演示数据，建议先导出备份。</p>
        </section>
      </div>
      <div className="modal-foot">
        <Btn onClick={onClose}>取消</Btn>
        <Btn color="green" onClick={save}>保存</Btn>
      </div>
    </Modal>
  )
}
