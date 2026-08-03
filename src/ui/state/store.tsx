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
import {
  snapshotFields,
  type Fields,
  type FormRow,
  type Photo,
  type Rotate,
} from '../../core/models'
import { DEFAULT_STYLE, type StampPos, type StampStyle } from '../../core/renderStamp'
import type { StoredPaths } from '../../platform/ports'
import { usePorts } from './ports'

/** `camera` 는 전체화면이라 오버레이가 아니라 화면이다 — 프리뷰가 폰 화면을 통째로 쓴다 */
export type Screen = 'home' | 'main' | 'list' | 'export' | 'settings' | 'form' | 'camera'

/** 일괄 적용을 되돌리기 위한 최소 스냅샷 (03 §2.7) */
export interface BulkUndo {
  key: string
  label: string
  before: { id: string; value: string; rev: number }[]
}

/**
 * 방금 표를 고친 것이 **무엇이었나** — 표에 무엇을 보여줄지도 이걸 따른다.
 *
 * 이 구분이 없어서 사진이 오염됐다 (2026-07-30). 주 동선은 "표 고치고 → 촬영, 반복" 인데
 * 표가 «현재 사진 편집기» 로 동작하는 바람에, 다음 집 호수를 넣는 순간
 * **방금 찍은 사진의 호수가 덮어써졌다.**
 *
 * 앱이 알아서 판단하지 않는다. 그렇다고 고칠 때마다 묻지도 않는다 —
 * 주 동선에서 100번 반복되는 확인창은 읽지 않고 누르게 되어 스스로를 무력화한다.
 * **사용자가 표 위 스위치로 직접 켠다**(사용자 결정, 2026-07-31).
 *
 * - `shoot` — 새로 찍을 사진용. 이미 찍은 사진은 절대 안 바뀐다. **기본값이고 안전한 쪽이다.**
 * - `edit`  — 지금 보고 있는 사진 수정. 사용자가 켠 동안만.
 *   **찍으면 꺼지고, 메인을 벗어나도 꺼진다.**
 */
export type Mode = 'shoot' | 'edit'

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
  /**
   * **폴더는 단지까지만. 동/호수는 파일명 앞으로** (2026-08-03 사용자 결정).
   *
   * 전달이 «갤러리에서 다중선택 → 카톡» 이라 폴더 규칙이 곧 **갤러리 앨범 규칙**이다.
   * 갤러리는 맨 끝 폴더 이름만 앨범으로 보므로 —
   *
   * - `단지/동호수` 2단이면 앨범이 **세대 수만큼**(50개) 생기고, 단지가 달라도 동호수가 같으면
   *   **앨범 이름이 「01」로 겹친다**(실기기에서 `행복아파트/01`·`중리/01` 둘 다 `bucket=01` 확인).
   * - `단지+동호수` 를 한 폴더로 합쳐도 앨범 수는 그대로고, 파일탐색기에서 세대 폴더만 쭉 나열된다.
   *
   * 동/호수를 **파일명 맨 앞**에 두면 폴더도 앨범도 **단지 수만큼**(2개)으로 줄고 이름도 유일하다.
   * 이름순 정렬이 곧 세대별 묶음이라 골라 보내기도 그대로 된다.
   */
  folderKeys: ['danji'],
  fileKeys: ['ho', 'work', 'phase'],
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
  /** 메타만 든다. 펼친 사진은 `ui/state/images` 캐시가 상한을 두고 따로 관리한다 (02 §4) */
  photos: Photo[]
  trash: Photo[]
  cur: number
  /** 사진이 없을 때 다음 촬영에 쓸 값 */
  slate: Fields
  /** 개인 입력이력 — 입력 시트 칩 재료 */
  history: Record<string, string[]>
  sheet: Sheet
  snack: Snack | null
  bulkUndo: BulkUndo | null
  /** 방금 지운 사진 — 되돌리면 원래 자리로 돌아간다 */
  lastRemoved: { photo: Photo; at: number } | null
  bigText: boolean
  mode: Mode
  /**
   * 사용법(도움말). 화면이 아니라 **덮개**다 — 어디서 열든 닫으면 하던 자리로 그대로 돌아온다.
   * 화면으로 만들면 뒤로가기 목적지를 화면마다 정해야 하는데, 그럴 이유가 없다.
   */
  help: boolean
}

/** 저장소에 남겨 두는 설정 — 사진이 아닌 것들 */
export type Settings = Pick<State, 'form' | 'style' | 'cfg' | 'slate' | 'history'>

export type Action =
  | { type: 'go'; screen: Screen }
  | { type: 'hydrate'; photos: Photo[]; trash: Photo[]; settings: Settings | null }
  /** 바이트는 이미 저장소로 갔다. 여기 오는 건 메타뿐 */
  | {
      type: 'addPhoto'
      id: string
      width: number
      height: number
      sha256: string
      paths: StoredPaths
      /** 촬영 화면에서 고른 표 자리. 안 주면 설정의 「다음 촬영 기본값」 */
      stampPos?: StampPos
      /** 셔터 순간 화면 방향으로 판정한 보정 회전 (`Photo.rotate`) */
      rotate?: Rotate
    }
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
  | { type: 'mode'; mode: Mode }
  | { type: 'help'; on: boolean }
  | { type: 'markExported' }
  /** 현재 사진을 시계방향 90° 더 돌린다 (표시용. 원본은 안 건드린다) */
  | { type: 'rotate' }

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
  mode: 'shoot',
  help: false,
}

/**
 * 지금 편집 대상.
 *
 * **모드가 정한다.** 사진이 있다고 무조건 그 사진을 고치면, 다음 촬영을 위해 넣은 값이
 * 방금 찍은 사진을 덮어쓴다 (2026-07-30 실기기에서 3장 전부 오염).
 */
export function currentFields(s: State): Fields {
  return s.mode === 'edit' && s.photos.length ? s.photos[s.cur].fields : s.slate
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
  if (s.mode === 'edit' && s.photos.length) return s.photos[s.cur].fields
  return snapshotFields(s.form, s.slate, { date: todayISO() })
}

/**
 * 저장된 서식에 **코드가 정하는 것만** 다시 심는다.
 *
 * 서식은 통째로 저장되므로, 기본 서식을 고쳐도 이미 쓰던 사람에게는 영영 반영되지 않는다
 * (`구분`을 선택으로 바꿔도 폰에서는 그대로 필수였다 — 2026-07-30).
 * 그래서 소유를 가른다: **코드 = `kind`·`req`·`input`·`options`, 사용자 = `label`·`on`·`order`·`default`.**
 * 사용자가 추가한 항목(`custom*`)은 기본 서식에 없으므로 그대로 둔다.
 */
function reseed(form: FormRow[]): FormRow[] {
  return form.map((r) => {
    const seed = DEFAULT_FORM.find((d) => d.key === r.key)
    if (!seed) return r
    return { ...r, kind: seed.kind, req: seed.req, input: seed.input, options: seed.options }
  })
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
      /**
       * 화면을 옮기면 **수정 모드는 손을 뗀다** (2026-07-31).
       *
       * 켜 둔 채 목록·설정에 다녀오면 돌아와서도 켜져 있는 걸 잊는다 — 그 상태로 다음 집
       * 호수를 넣으면 직전 사진이 다시 오염된다. 화면을 벗어나는 건 그 사진을 고치던 흐름이
       * 끝났다는 뜻이므로 안전한 쪽으로 되돌린다. (시간 경과로 푸는 건 안 한다 —
       * 고치던 중 조용히 풀리면 이번엔 반대 방향으로 오염된다)
       */
      return { ...s, screen: a.screen, sheet: null, mode: 'shoot' }

    case 'hydrate': {
      // 저장된 게 없으면 `settings` 는 null — 그때는 기본값 그대로 간다
      const settings = a.settings
      /**
       * `stampPos` 가 없던 시절 사진에 **그때 쓰던 설정값을 박아 준다.**
       * 안 채우면 그 사진들만 설정의 자리를 계속 따라다녀서, 촬영 화면에서 자리를 옮길 때마다
       * 옛 사진의 표가 같이 움직인다 — 이 필드를 만든 이유가 그대로 되살아난다.
       */
      const pos = settings?.style.pos ?? s.style.pos
      const seat = (p: Photo): Photo => (p.stampPos ? p : { ...p, stampPos: pos })
      return {
        ...s,
        ...(settings ?? {}),
        ...(settings ? { form: reseed(settings.form) } : {}),
        photos: a.photos.map(seat),
        trash: a.trash.map(seat),
        cur: Math.max(0, a.photos.length - 1),
      }
    }

    case 'addPhoto': {
      // 필수값이 비어도 막지 않는다 (03 §4.3).
      // 새 사진의 밑값은 **언제나 slate** 다 — 한 장을 고치는 중이었더라도 그 값이 새 사진에 붙으면 안 된다
      const base = s.slate
      const photo: Photo = {
        id: a.id,
        capturedAt: new Date().toISOString(),
        templateId: 'default',
        phase: base.phase ?? '',
        fields: snapshotFields(s.form, base, { date: todayISO() }),
        width: a.width,
        height: a.height,
        // 브라우저(IndexedDB)에서는 자리 이름이 없어 빈 문자열, 안드로이드에서는 파일 경로
        originalPath: a.paths.original,
        sha256: a.sha256,
        thumb320Path: a.paths.thumb,
        // 촬영 화면에서 눈으로 확인하고 고른 자리. 불러오기처럼 고를 기회가 없었으면 설정값
        stampPos: a.stampPos ?? s.style.pos,
        rotate: a.rotate ?? 0,
        rev: 1,
        exportedRev: 0,
      }
      const photos = [...s.photos, photo]
      // 안내 문구는 여기서 만들지 않는다 — 여러 장을 들일 때 장마다 스낵바가 뜬다.
      // 몇 장 들어왔는지는 다 넣은 쪽(Main)이 한 번만 말한다.
      // 찍었으면 다시 촬영 쪽이다. 한 장 고치던 중이었어도 손을 뗀다
      return { ...s, photos, cur: photos.length - 1, mode: 'shoot' }
    }

    case 'setValue': {
      const history = pushHistory(s.history, a.key, a.value)
      // 촬영 모드에서는 **찍은 사진을 건드리지 않는다.** 다음 촬영에 쓸 값만 바뀐다
      if (s.mode === 'shoot' || !s.photos.length) {
        /**
         * auto 항목(단지·작업자)의 «다음 촬영값» 은 slate 가 아니라 **서식 기본값**이다
         * (`snapshotFields` 가 auto 는 default 에서 가져간다).
         * slate 에 넣으면 아무 데도 안 쓰이는 값이 쌓이고, 다음 사진에는 **옛 단지**가 붙는다 —
         * "단지를 바꿔도 다시 찍으면 이전 아파트가 나온다" 가 이것이었다 (2026-07-30).
         */
        if (s.form.find((r) => r.key === a.key)?.kind === 'auto') {
          return {
            ...s,
            form: s.form.map((r) => (r.key === a.key ? { ...r, default: a.value } : r)),
            sheet: null,
            history,
          }
        }
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

    case 'mode':
      return { ...s, mode: a.mode }

    case 'help':
      return { ...s, help: a.on }

    /**
     * 회전 — **원본은 안 건드리고 «표시용 각도»만 돌린다**(`Photo.rotate`).
     *
     * 이 기종 카메라가 방향과 무관하게 EXIF 6 을 붙여서, 가로로 찍으면 눕는다(2026-08-03).
     * 촬영 때 자동으로 보정하지만 어긋나는 경우가 있어 사람이 고칠 길을 둔다.
     * `rev` 를 올려 「📤 최신 아님」 이 뜨게 한다 — 내보낸 파일과 달라졌기 때문이다.
     */
    case 'rotate': {
      if (!s.photos.length) return s
      const photos = s.photos.map((p, i) =>
        i === s.cur
          ? { ...p, rotate: (((p.rotate ?? 0) + 90) % 360) as Rotate, rev: p.rev + 1 }
          : p,
      )
      return { ...s, photos }
    }

    case 'markExported':
      return { ...s, photos: s.photos.map((p) => ({ ...p, exportedRev: p.rev })) }

    default:
      return s
  }
}

const Ctx = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null)

/**
 * 다시 써야 하는지 가르는 서명.
 * 값 수정은 `rev`, 내보내기는 `exportedRev`, 삭제는 `deletedAt` 만 움직인다 —
 * 이 셋이 그대로면 저장소에 있는 것과 같다.
 */
const sign = (p: Photo) => `${p.rev}|${p.exportedRev}|${p.deletedAt ?? ''}`

export function StoreProvider({ children }: { children: ReactNode }) {
  const ports = usePorts()
  const [state, dispatch] = useReducer(reducer, initialState)
  /** 복원이 끝나기 전에 저장하면 기본값이 저장분을 덮어쓴다 */
  const [ready, setReady] = useState(false)
  /** 저장소에 이미 쓴 것 — id → 서명 */
  const written = useRef(new Map<string, string>())
  /** 기준선을 잡았는가. 첫 동기화는 쓰지도 지우지도 않는다 */
  const seeded = useRef(false)

  // 부팅 복원
  useEffect(() => {
    let alive = true
    const boot = async () => {
      try {
        // 메타만 읽는다. 사진 바이트는 화면이 필요로 할 때 한 장씩 (02 §4)
        const stored = await ports.db.load()
        if (!alive) return
        dispatch({
          type: 'hydrate',
          photos: stored.filter((p) => !p.deletedAt),
          trash: stored.filter((p) => p.deletedAt),
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

  // 메타 영속화 — 바뀐 것만. 원본·썸네일은 촬영 시점에 이미 저장소로 갔다
  useEffect(() => {
    if (!ready) return
    const live = [...state.photos, ...state.trash]

    // 첫 실행은 기준선만 잡고 아무것도 쓰지 않는다.
    // ⚠️ 기준선을 `load()` 결과로 잡으면 안 된다. 복원 dispatch 가 어긋나 상태가 빈 채로
    // 이 이펙트가 돌면 "사용자가 전부 지웠다"로 읽혀 **저장된 사진을 통째로 지운다**(실제로 겪음).
    // 상태에 실제로 올라온 것만 기준선으로 삼으면 그런 일이 생기지 않는다.
    if (!seeded.current) {
      seeded.current = true
      for (const p of live) written.current.set(p.id, sign(p))
      return
    }

    const now = new Set(live.map((p) => p.id))
    for (const p of live) {
      const s = sign(p)
      if (written.current.get(p.id) === s) continue
      written.current.set(p.id, s)
      void ports.db.saveMeta(p)
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
