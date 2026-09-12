// 同步引擎纯函数的单元测试：编码 / 记录级合并 / 墓碑删除传播 / 快照解码
import { describe, it, expect } from 'vitest'
import { encodeState, applyPull, decodeSnapshot } from '../sync.js'
import { seed, reducer } from '../store.jsx'

const base = () => seed()

describe('encodeState：state → 同步格式', () => {
  it('列表切片按 id 编码成 records', () => {
    let s = base()
    s = reducer(s, { type: 'TODO_ADD', text: '写周报' })
    s = reducer(s, { type: 'LEDGER_ADD', dir: 'out', amount: 25, cat: '餐饮', note: '午饭' })
    const enc = encodeState(s)
    const todoId = s.todos[0].id
    expect(enc.todos.records[todoId]).toMatchObject({ text: '写周报', updatedAt: expect.any(Number) })
    expect(enc.ledger.records[s.ledger[0].id]).toMatchObject({ amount: 25 })
  })

  it('weights 每条带 id（=day），reviews 以天为记录', () => {
    let s = base()
    s = reducer(s, { type: 'WEIGHT_ADD', day: '2026-09-09', kg: 65.5 })
    s = reducer(s, { type: 'REVIEW_SAVE', day: '2026-09-09', mood: 1, good: 'x', thanks: 'y', tomorrow: 'z' })
    const enc = encodeState(s)
    expect(enc.weights.records['2026-09-09']).toMatchObject({ kg: 65.5, id: '2026-09-09' })
    expect(enc.reviews.records['2026-09-09']).toMatchObject({ mood: 1, updatedAt: expect.any(Number) })
  })

  it('KV 切片编码为 __kv 且带上 _touched 时间戳；settings 密钥被剥掉', () => {
    let s = base()
    s = reducer(s, { type: 'SETTINGS_SET', patch: { apiKey: 'sk-secret', baseUrl: 'https://x' } })
    const enc = encodeState(s)
    const kv = enc.settings.records.__kv
    expect(kv.baseUrl).toBe('https://x')
    expect(kv.updatedAt).toBe(s._touched.settings)
    expect(kv.apiKey).toBeUndefined()
    expect(kv.webdavPass).toBeUndefined()
  })

  it('回收站条目进 trash 切片', () => {
    let s = base()
    s = reducer(s, { type: 'TODO_ADD', text: '要删的' })
    const id = s.todos[0].id
    s = reducer(s, { type: 'TODO_DEL', id })
    const enc = encodeState(s)
    expect(Object.values(enc.trash.records)).toHaveLength(1)
    expect(Object.values(enc.trash.records)[0]).toMatchObject({ kind: 'todo', refId: id })
  })
})

describe('applyPull：记录级合并', () => {
  it('远端新增记录会被并进来（新 id 直接落地）', () => {
    const s = base()
    const remoteTodo = { id: 'r1', text: '远端待办', done: false, day: '2026-09-09', updatedAt: 1000 }
    const { state, changed } = applyPull(s, { todos: { records: { r1: remoteTodo } } })
    expect(changed).toBe(true)
    expect(state.todos.map((x) => x.id)).toContain('r1')
    expect(s.todos).toHaveLength(0) // 原对象不被修改（纯函数）
  })

  it('远端更新较新 → 覆盖本地；较旧 → 保留本地', () => {
    let s = base()
    s = reducer(s, { type: 'TODO_ADD', text: '本地版本' })
    const id = s.todos[0].id
    const localUpdatedAt = s.todos[0].updatedAt
    const newer = { ...s.todos[0], text: '远端较新', updatedAt: localUpdatedAt + 100 }
    const older = { ...s.todos[0], text: '远端较旧', updatedAt: localUpdatedAt - 100 }
    expect(applyPull(s, { todos: { records: { [id]: newer } } }).state.todos[0].text).toBe('远端较新')
    expect(applyPull(s, { todos: { records: { [id]: older } } }).state.todos[0].text).toBe('本地版本')
  })

  it('KV 整块按 _touched 新者胜；settings 合并不清掉本地密钥', () => {
    let s = base()
    s = reducer(s, { type: 'SETTINGS_SET', patch: { apiKey: 'sk-local', city: '' } })
    const remoteSettings = { records: { __kv: { id: '__kv', updatedAt: s._touched.settings + 500, city: '杭州' } } }
    const { state } = applyPull(s, { settings: remoteSettings })
    expect(state.settings.city).toBe('杭州')
    expect(state.settings.apiKey).toBe('sk-local') // 远端没有密钥字段 → 保留本地
    // 远端更旧 → 不覆盖
    const stale = { records: { __kv: { id: '__kv', updatedAt: 1, city: '北京' } } }
    expect(applyPull(s, { settings: stale }).state.settings.city).toBe('')
  })

  it('墓碑传播：远端删除会删掉本地同 id 且更旧的记录', () => {
    let s = base()
    s = reducer(s, { type: 'TODO_ADD', text: '会被删的' })
    const id = s.todos[0].id
    const tomb = { id: 't1', kind: 'todo', refId: id, data: s.todos[0], deletedAt: s.todos[0].updatedAt + 10, updatedAt: s.todos[0].updatedAt + 10, restoredAt: 0 }
    const { state, changed } = applyPull(s, { trash: { records: { t1: tomb } } })
    expect(changed).toBe(true)
    expect(state.todos.map((x) => x.id)).not.toContain(id)
  })

  it('编辑比删除新 → 活下来（后编辑赢）', () => {
    let s = base()
    s = reducer(s, { type: 'TODO_ADD', text: '先建' })
    const id = s.todos[0].id
    const t0 = s.todos[0].updatedAt
    const tomb = { id: 't1', kind: 'todo', refId: id, data: s.todos[0], deletedAt: t0 + 10, updatedAt: t0 + 10, restoredAt: 0 }
    const edited = { ...s.todos[0], text: '删完又改了一版', updatedAt: t0 + 20 }
    const { state } = applyPull(s, {
      todos: { records: { [id]: edited } },
      trash: { records: { t1: tomb } },
    })
    expect(state.todos.map((x) => x.id)).toContain(id)
    expect(state.todos[0].text).toBe('删完又改了一版')
  })

  it('restoredAt 墓碑不删本地记录（恢复事件不引发删除）', () => {
    let s = base()
    s = reducer(s, { type: 'TODO_ADD', text: '恢复回来的' })
    const id = s.todos[0].id
    const tomb = { id: 't1', kind: 'todo', refId: id, data: s.todos[0], deletedAt: 1, updatedAt: 1, restoredAt: 999 }
    const { state } = applyPull(s, { trash: { records: { t1: tomb } } })
    expect(state.todos.map((x) => x.id)).toContain(id)
  })

  it('weight 墓碑按 day 命中体重记录', () => {
    let s = base()
    s = reducer(s, { type: 'WEIGHT_ADD', day: '2026-09-09', kg: 65 })
    const tomb = { id: 't1', kind: 'weight', refId: '2026-09-09', data: s.weights[0], deletedAt: s.weights[0].updatedAt + 5, updatedAt: s.weights[0].updatedAt + 5, restoredAt: 0 }
    const { state } = applyPull(s, { trash: { records: { t1: tomb } } })
    expect(state.weights).toHaveLength(0)
  })
})

describe('decodeSnapshot：同步格式 → 存档形状', () => {
  it('和 encodeState 互逆（快照恢复可用）', () => {
    let s = base()
    s = reducer(s, { type: 'TODO_ADD', text: '快照里的待办' })
    s = reducer(s, { type: 'REVIEW_SAVE', day: '2026-09-09', mood: 2, good: 'a', thanks: 'b', tomorrow: 'c' })
    s = reducer(s, { type: 'PROFILE_SET', patch: { name: '镇长' } })
    const enc = encodeState(s)
    const dec = decodeSnapshot(enc)
    expect(dec.todos[0].text).toBe('快照里的待办')
    expect(dec.reviews['2026-09-09'].mood).toBe(2)
    expect(dec.profile.name).toBe('镇长')
    expect(dec.profile.id).toBeUndefined() // __kv 的伪 id 不残留
  })
})
