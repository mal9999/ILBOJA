/**
 * 앱 상태 — photos · cur · slate · form · style (03 §5.1).
 * 플랫폼은 여기서도 `ports` 로만 만진다.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react'
import { DEFAULT_FORM } from '../../core/defaultForm'
import { snapshotFields, type Fields, type FormRow, type Photo } from '../../core/models'
import { DEFAULT_STYLE, type StampStyle } from '../../core/renderStamp'
import type { CapturedImage, StoredPhoto } from '../../platform/ports'
import { usePorts } from './ports'

export type Screen = 'home' | 'main' | 'list' | 'export' | 'settings' | 'form'

/** 화면에 그릴 것과 저장할 원본을 함께 들고 있는 Photo */
export interface UiPhoto extends Photo {
  image: CanvasImageSource
  width: number
  height: number
  /** 원본 바이트. 저장할 때 그대로 쓴다 */
  blob: Blob
}

/** 일괄 적용을 되돌리기 위한 최소 스냅샷 (03 §2.7) */
export interface BulkUndo {
  key: string
  label: string
  before: { id: string; value: string; rev: number }[]
}

export type Sheet =
  | { kind: 'input'; key: string }
  /** 서식 기본값(Form.default) 편집. 사진 값이 아니다 */
  | { kind: 'default'; key: string }
  | { kind: 'bulk'; key: string; value: string }
  | { kind: 'rename'; key: string }
  | null

export interface Snack {
  msg: string
  /** 있으면 [되돌리기] 버튼이 뜨고, 누르면 이 액션이 나간다 */
  undo?: Action
}

export type BulkRange = 'one' | 'fromHere' | 'all'

/**
 * 저장·정리 설정 (00.요구사항 §6.4 · app.html `CFG`).
 * 폴더·파일명으로 쓸 항목 지정이 경쟁 앱의 최대 강점 — "알아서 정리돼서 찾기 편하다".
 */
export interface Config {
  folderKeys: string[]
  fileKeys: string[]
  folderPath: string
  /** 입력 이력 보관 개수 */
  histCount: number
  camRes: string
  saveRes: string
  font: string
}

export const DEFAULT_CONFIG: Config = {
  folderKeys: ['danji', 'ho'],
  fileKeys: ['work', 'phase'],
  folderPath: '/Documents/일보자',
  histCount: 50,
  camRes: '4080 × 3060 (4:3)',
  saveRes: '2048',
  font: '시스템 기본',
}

export interface State {
  screen: Screen
  form: FormRow[]
  style: StampStyle
  cfg: Config
  photos: UiPhoto[]
  trash: UiPhoto[]
  cur: number
  /** 사진이 없을 때 다음 촬영에 쓸 값 */
  slate: Fields
  /** 개인 입력이력 — 입력 시트 칩 재료 */
  history: Record<string, string[]>
  sheet: Sheet
  snack: Snack | null
  bulkUndo: BulkUndo | null
  /** 방금 지운 사진 — 되돌리면 원래 자리로 돌아간다 */
  lastRemoved: { photo: UiPhoto; at: number } | null
  bigText: boolean
}

/** 저장소에 남겨 두는 설정 — 사진이 아닌 것들 */
export type Settings = Pick<State, 'form' | 'style' | 'cfg' | 'slate' | 'history'>

export type Action =
  | { type: 'go'; screen: Screen }
  | { type: 'hydrate'; photos: UiPhoto[]; trash: UiPhoto[]; settings: Settings | null }
  | { type: 'addPhoto'; image: CapturedImage; note?: string }
  | { type: 'setValue'; key: string; value: string }
  | { type: 'move'; delta: number }
  | { type: 'goto'; index: number }
  | { type: 'remove' }
  | { type: 'restoreRemoved' }
  | { type: 'bulk'; key: string; value: string; range: BulkRange }
  | { type: 'undoBulk' }
  | { type: 'toggleRow'; key: string }
  | { type: 'renameRow'; key: string; label: string }
  | { type: 'moveRow'; key: string; delta: number }
  | { type: 'addRow'; label: string }
  | { type: 'togglePathKey'; which: 'folderKeys' | 'fileKeys'; key: string }
  | { type: 'setCfg'; patch: Partial<Config> }
  | { type: 'resetForm' }
  | { type: 'setStyle'; patch: Partial<StampStyle> }
  | { type: 'setDefault'; key: string; value: string }
  | { type: 'sheet'; sheet: Sheet }
  | { type: 'snack'; snack: Snack | null }
  | { type: 'bigText'; on: boolean }
  | { type: 'markExported' }

const todayISO = () => new Date().toISOString().slice(0, 10)

export const initialState: State = {
  screen: 'home',
  form: DEFAULT_FORM.map((r) => ({
    ...r,
    default:
      r.key === 'danji' ? '행복아파트' : r.key === 'worker' ? '홍길동' : r.default,
  })),
  style: DEFAULT_STYLE,
  cfg: DEFAULT_CONFIG,
  photos: [],
  trash: [],
  cur: 0,
  slate: { phase: '작업 전' },
  history: {},
  sheet: null,
  snack: null,
  bulkUndo: null,
  lastRemoved: null,
  bigText: false,
}

/** 지금 편집 대상 — 사진이 있으면 그 사진, 없으면 slate */
export function currentFields(s: State): Fields {
  return s.photos.length ? s.photos[s.cur].fields : s.slate
}

/**
 * 표에 보여줄 값 — "지금 찍으면 표가 이렇게 나온다".
 *
 * `slate` 에는 auto 항목(단지·작업일자·작업자)이 없다. 그 값들은 촬영 순간에
 * `snapshotFields` 가 채우기 때문이다. 그래서 촬영 전 표를 slate 로 그리면
 * 날짜·단지·작업자가 빈칸으로 보인다 — 알고 있는 값인데도.
 * 표시할 때도 같은 스냅샷을 한 번 태워서 화면과 결과물을 일치시킨다.
 */
export function previewFields(s: State): Fields {
  if (s.photos.length) return s.photos[s.cur].fields
  return snapshotFields(s.form, s.slate, { date: todayISO() })
}

/** 일괄 대상 사진 인덱스 */
function targets(s: State, range: BulkRange): number[] {
  if (range === 'one') return [s.cur]
  if (range === 'all') return s.photos.map((_, i) => i)
  return s.photos.map((_, i) => i).filter((i) => i >= s.cur)
}

function pushHistory(history: State['history'], key: string, value: string) {
  const v = value.trim()
  if (!v) return history
  const prev = history[key] ?? []
  if (prev[0] === v) return history
  return { ...history, [key]: [v, ...prev.filter((x) => x !== v)].slice(0, 50) }
}

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'go':
      return { ...s, screen: a.screen, sheet: null }

    case 'hydrate':
      // 저장된 게 없으면 `settings` 는 null — 그때는 기본값 그대로 간다
      return {
        ...s,
        ...(a.settings ?? {}),
        photos: a.photos,
        trash: a.trash,
        cur: Math.max(0, a.photos.length - 1),
      }

    case 'addPhoto': {
      // 필수값이 비어도 막지 않는다 (03 §4.3)
      const base = currentFields(s)
      const photo: UiPhoto = {
        id: `p${Date.now()}_${s.photos.length}`,
        capturedAt: new Date().toISOString(),
        templateId: 'default',
        phase: base.phase ?? '',
        fields: snapshotFields(s.form, base, { date: todayISO() }),
        originalPath: '', // 브라우저엔 파일시스템이 없다. 단계 4 네이티브에서 채운다
        sha256: a.image.sha256,
        thumb320Path: '',
        rev: 1,
        exportedRev: 0,
        image: a.image.source,
        width: a.image.width,
        height: a.image.height,
        blob: a.image.blob,
      }
      const photos = [...s.photos, photo]
      return {
        ...s,
        photos,
        cur: photos.length - 1,
        snack: a.note ? { msg: a.note } : s.snack,
      }
    }

    case 'setValue': {
      const history = pushHistory(s.history, a.key, a.value)
      if (!s.photos.length) {
        return { ...s, slate: { ...s.slate, [a.key]: a.value }, sheet: null, history }
      }
      const photos = s.photos.map((p, i) =>
        i === s.cur
          ? { ...p, fields: { ...p.fields, [a.key]: a.value }, rev: p.rev + 1 }
          : p,
      )
      return { ...s, photos, sheet: null, history }
    }

    case 'move': {
      const i = s.cur + a.delta
      if (i < 0 || i >= s.photos.length) return s
      return { ...s, cur: i }
    }

    case 'goto':
      return { ...s, cur: a.index, screen: 'main' }

    case 'remove': {
      if (!s.photos.length) return { ...s, snack: { msg: '삭제할 사진이 없습니다' } }
      const at = s.cur
      const gone = s.photos[at]
      const photos = s.photos.filter((_, i) => i !== at)
      return {
        ...s,
        photos,
        trash: [{ ...gone, deletedAt: new Date().toISOString() }, ...s.trash],
        cur: Math.max(0, Math.min(at, photos.length - 1)),
        lastRemoved: { photo: gone, at },
        snack: { msg: '1장 뺐음', undo: { type: 'restoreRemoved' } },
      }
    }

    case 'restoreRemoved': {
      const r = s.lastRemoved
      if (!r) return s
      const photos = [...s.photos]
      photos.splice(Math.min(r.at, photos.length), 0, r.photo)
      return {
        ...s,
        photos,
        trash: s.trash.filter((t) => t.id !== r.photo.id),
        cur: Math.min(r.at, photos.length - 1),
        lastRemoved: null,
        snack: null,
      }
    }

    case 'bulk': {
      const idx = targets(s, a.range)
      const before = idx.map((i) => ({
        id: s.photos[i].id,
        value: s.photos[i].fields[a.key] ?? '',
        rev: s.photos[i].rev,
      }))
      const set = new Set(idx)
      const photos = s.photos.map((p, i) =>
        set.has(i) ? { ...p, fields: { ...p.fields, [a.key]: a.value }, rev: p.rev + 1 } : p,
      )
      const label = s.form.find((r) => r.key === a.key)?.label ?? a.key
      return {
        ...s,
        photos,
        sheet: null,
        history: pushHistory(s.history, a.key, a.value),
        bulkUndo: { key: a.key, label, before },
        snack: { msg: `${idx.length}장 바뀜`, undo: { type: 'undoBulk' } },
      }
    }

    case 'undoBulk': {
      const u = s.bulkUndo
      if (!u) return s
      const map = new Map(u.before.map((b) => [b.id, b]))
      let restored = 0
      let skipped = 0
      const photos = s.photos.map((p) => {
        const b = map.get(p.id)
        if (!b) return p
        // 일괄 이후 그 사진을 또 고쳤으면 건너뛴다 = 개별 수정분 비침범 (03 §2.7)
        if (p.rev !== b.rev + 1) {
          skipped++
          return p
        }
        restored++
        return { ...p, fields: { ...p.fields, [u.key]: b.value }, rev: p.rev + 1 }
      })
      return {
        ...s,
        photos,
        bulkUndo: null,
        snack: {
          msg: skipped
            ? `${restored}장 되돌림 · ${skipped}장은 그 뒤 직접 고쳐서 그대로 둠`
            : `${restored}장 되돌림`,
        },
      }
    }

    case 'toggleRow':
      return {
        ...s,
        form: s.form.map((r) => (r.key === a.key && !r.req ? { ...r, on: !r.on } : r)),
      }

    case 'renameRow':
      return {
        ...s,
        form: s.form.map((r) => (r.key === a.key ? { ...r, label: a.label } : r)),
        sheet: null,
      }

    case 'moveRow': {
      const sorted = [...s.form].sort((x, y) => x.order - y.order)
      const i = sorted.findIndex((r) => r.key === a.key)
      const j = i + a.delta
      if (i < 0 || j < 0 || j >= sorted.length) return s
      ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
      return { ...s, form: sorted.map((r, k) => ({ ...r, order: k + 1 })) }
    }

    case 'addRow': {
      const label = a.label.trim()
      if (!label) return s
      // key 는 사람이 바꿀 수 없다. 충돌하지 않게 기계적으로 만든다
      let n = 1
      while (s.form.some((r) => r.key === `custom${n}`)) n++
      const row: FormRow = {
        key: `custom${n}`,
        label,
        kind: 'slate',
        on: true,
        req: false,
        order: s.form.length + 1,
        input: 'choice',
        options: [],
      }
      return { ...s, form: [...s.form, row], sheet: null }
    }

    case 'togglePathKey': {
      const list = s.cfg[a.which]
      const next = list.includes(a.key) ? list.filter((k) => k !== a.key) : [...list, a.key]
      return { ...s, cfg: { ...s.cfg, [a.which]: next } }
    }

    case 'setCfg':
      return { ...s, cfg: { ...s.cfg, ...a.patch }, sheet: null }

    case 'resetForm':
      return {
        ...s,
        form: initialState.form.map((r) => ({ ...r })),
        cfg: { ...DEFAULT_CONFIG },
        snack: { msg: '표 항목과 저장 설정을 처음 상태로 되돌렸습니다' },
      }

    case 'setStyle':
      return { ...s, style: { ...s.style, ...a.patch } }

    case 'setDefault':
      return {
        ...s,
        form: s.form.map((r) => (r.key === a.key ? { ...r, default: a.value } : r)),
        sheet: null,
      }

    case 'sheet':
      return { ...s, sheet: a.sheet }

    case 'snack':
      return { ...s, snack: a.snack }

    case 'bigText':
      return { ...s, bigText: a.on }

    case 'markExported':
      return { ...s, photos: s.photos.map((p) => ({ ...p, exportedRev: p.rev })) }

    default:
      return s
  }
}

const Ctx = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null)

/** 저장할 것만 남긴다 — 화면용 비트맵과 원본은 IndexedDB 쪽 몫이다 */
function toPhoto({ image: _i, width: _w, height: _h, blob: _b, ...photo }: UiPhoto): Photo {
  return photo
}

function toUi(t: StoredPhoto): UiPhoto {
  return { ...t.photo, image: t.image, width: t.width, height: t.height, blob: t.blob }
}

/**
 * 다시 써야 하는지 가르는 서명.
 * 값 수정은 `rev`, 내보내기는 `exportedRev`, 삭제는 `deletedAt` 만 움직인다 —
 * 이 셋이 그대로면 저장소에 있는 것과 같다.
 */
const sign = (p: UiPhoto) => `${p.rev}|${p.exportedRev}|${p.deletedAt ?? ''}`

export function StoreProvider({ children }: { children: ReactNode }) {
  const ports = usePorts()
  const [state, dispatch] = useReducer(reducer, initialState)
  /** 복원이 끝나기 전에 저장하면 기본값이 저장분을 덮어쓴다 */
  const [ready, setReady] = useState(false)
  /** 저장소에 이미 쓴 것 — id → 서명 */
  const written = useRef(new Map<string, string>())

  // 부팅 복원
  useEffect(() => {
    let alive = true
    const boot = async () => {
      try {
        const stored = await ports.db.load()
        if (!alive) return
        for (const t of stored) written.current.set(t.photo.id, sign(toUi(t)))
        dispatch({
          type: 'hydrate',
          photos: stored.filter((t) => !t.photo.deletedAt).map(toUi),
          trash: stored.filter((t) => t.photo.deletedAt).map(toUi),
          settings: ports.storage.get<Settings>('settings'),
        })
      } finally {
        // 저장소가 막혀도(사파리 프라이빗 등) 앱은 굴러가야 한다
        if (alive) setReady(true)
      }
    }
    void boot()
    return () => {
      alive = false
    }
  }, [ports])

  // 사진 영속화 — 바뀐 것만 쓰고, 원본은 처음 한 번만 쓴다
  useEffect(() => {
    if (!ready) return
    const live = [...state.photos, ...state.trash]
    const now = new Set(live.map((p) => p.id))
    for (const p of live) {
      const s = sign(p)
      if (written.current.get(p.id) === s) continue
      const first = !written.current.has(p.id)
      written.current.set(p.id, s)
      void ports.db.save(toPhoto(p), first ? p.blob : undefined)
    }
    for (const id of [...written.current.keys()]) {
      if (now.has(id)) continue
      written.current.delete(id)
      void ports.db.remove(id)
    }
  }, [ready, ports, state.photos, state.trash])

  // 설정 영속화 — 사진에 견주면 작아서 통째로 쓴다.
  // `state` 통째로 걸면 사진을 넘길 때마다(cur·snack) 다시 쓴다. 저장할 것만 떼어 건다
  const { form, style, cfg, slate, history } = state
  useEffect(() => {
    if (!ready) return
    ports.storage.set<Settings>('settings', { form, style, cfg, slate, history })
  }, [ready, ports, form, style, cfg, slate, history])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('StoreProvider 밖에서 useStore 를 불렀다')
  return v
}
