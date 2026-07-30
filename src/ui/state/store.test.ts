/**
 * 상태 전이 테스트.
 * 핵심은 일괄 되돌리기가 **개별 수정분을 침범하지 않는지**다 (00.요구사항 §6.2 · 03 §2.7).
 */

import { describe, expect, it } from 'vitest'
import { initialState, previewFields, reducer, type Action, type State } from './store'

/** 촬영 결과 메타. 사진 바이트는 상태에 들어오지 않는다 (02 §4) */
let seq = 0
const shot = (): Action => ({
  type: 'addPhoto',
  id: `p${++seq}`,
  width: 1200,
  height: 900,
  sha256: 'deadbeef',
  paths: { original: '', thumb: '' },
})

const run = (s: State, ...actions: Action[]) => actions.reduce(reducer, s)

/** 필수값을 채운 뒤 사진 n장 */
function withPhotos(n: number): State {
  let s = run(
    initialState,
    { type: 'setValue', key: 'ho', value: '101동 1502호' },
    { type: 'setValue', key: 'work', value: '누수 보수' },
  )
  for (let i = 0; i < n; i++) s = reducer(s, shot())
  return s
}

const workOf = (s: State) => s.photos.map((p) => p.fields.work)

describe('촬영', () => {
  it('필수값이 비어도 사진은 찍힌다 (촬영 게이트 없음)', () => {
    const s = reducer(initialState, shot())
    expect(s.photos).toHaveLength(1)
    expect(s.photos[0].fields.ho).toBe('')
    expect(s.sheet).toBeNull() // 입력 시트가 끼어들지 않는다
  })

  it('찍은 사진이 현재 사진이 된다', () => {
    const s = withPhotos(3)
    expect(s.cur).toBe(2)
  })

  it('직전 사진 값을 승계한다', () => {
    const s = withPhotos(2)
    expect(s.photos[1].fields.ho).toBe('101동 1502호')
  })

  it('auto 항목도 사진에 박힌다', () => {
    const s = withPhotos(1)
    expect(s.photos[0].fields.danji).toBe('행복아파트')
    expect(s.photos[0].fields.worker).toBe('홍길동')
    expect(s.photos[0].fields.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('previewFields — 화면에 보여줄 값', () => {
  it('촬영 전에도 단지·작업일자·작업자가 보인다 (slate 에는 없는 값들)', () => {
    const p = previewFields(initialState)
    expect(p.danji).toBe('행복아파트')
    expect(p.worker).toBe('홍길동')
    expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('촬영 전 미리보기가 실제로 찍힐 값과 같다', () => {
    const before = previewFields(initialState)
    const after = reducer(initialState, shot()).photos[0].fields
    expect(after).toEqual(before)
  })

  it('한 장을 고르는 중이면 그 사진 값을 보여준다', () => {
    const s = run(withPhotos(2), { type: 'goto', index: 0 }, { type: 'mode', mode: 'edit' })
    expect(previewFields(s)).toBe(s.photos[0].fields)
  })

  it('촬영 모드에서는 사진이 있어도 **다음에 찍을 값**을 보여준다', () => {
    const s = run(withPhotos(2), { type: 'goto', index: 0 })
    expect(previewFields(s)).not.toBe(s.photos[0].fields)
    expect(previewFields(s).ho).toBe(s.slate.ho)
  })
})

describe('개별 수정', () => {
  it('수정 모드에서는 그 사진만 바뀌고 rev 가 오른다', () => {
    const s = run(
      withPhotos(3),
      { type: 'mode', mode: 'edit' },
      { type: 'setValue', key: 'work', value: '창호 교체' },
    )
    expect(workOf(s)).toEqual(['누수 보수', '누수 보수', '창호 교체'])
    expect(s.photos[2].rev).toBe(2)
    expect(s.photos[0].rev).toBe(1)
  })

  /**
   * ★ 주 동선 회귀 방지. 이게 깨지면 **찍은 사진이 오염되는 그 버그**가 되살아난 것이다.
   * 현장: 101호를 찍고 → 다음 집 102호를 입력 → 찍는다. 1번 사진은 101호로 남아야 한다.
   */
  it('★ 촬영 모드에서 값을 넣어도 이미 찍은 사진은 안 바뀐다', () => {
    const s = run(
      withPhotos(1),
      { type: 'setValue', key: 'ho', value: '102동 201호' },
      { type: 'setValue', key: 'danji', value: '새아파트' },
    )
    expect(s.photos[0].fields.ho).toBe('101동 1502호')
    expect(s.photos[0].rev).toBe(1) // 손도 안 댔다
    expect(s.slate.ho).toBe('102동 201호')
  })

  it('사진이 없으면 slate 에 들어간다', () => {
    const s = reducer(initialState, { type: 'setValue', key: 'work', value: '누수 보수' })
    expect(s.slate.work).toBe('누수 보수')
    expect(s.photos).toHaveLength(0)
  })

  it('입력 이력이 최근 순으로 쌓이고 중복은 앞으로 올라온다', () => {
    const s = run(
      initialState,
      { type: 'setValue', key: 'work', value: '누수 보수' },
      { type: 'setValue', key: 'work', value: '창호 교체' },
      { type: 'setValue', key: 'work', value: '누수 보수' },
    )
    expect(s.history.work).toEqual(['누수 보수', '창호 교체'])
  })
})

describe('일괄 적용', () => {
  it('전체 N장에 적용된다', () => {
    const s = run(withPhotos(3), { type: 'bulk', key: 'work', value: '도배', range: 'all' })
    expect(workOf(s)).toEqual(['도배', '도배', '도배'])
    expect(s.snack?.msg).toBe('3장 바뀜')
  })

  it('이 사진부터 끝까지만 적용된다', () => {
    const s = run(
      withPhotos(4),
      { type: 'goto', index: 1 },
      { type: 'bulk', key: 'work', value: '도배', range: 'fromHere' },
    )
    expect(workOf(s)).toEqual(['누수 보수', '도배', '도배', '도배'])
  })

  it('이 사진만 적용된다', () => {
    const s = run(
      withPhotos(3),
      { type: 'goto', index: 0 },
      { type: 'bulk', key: 'work', value: '도배', range: 'one' },
    )
    expect(workOf(s)).toEqual(['도배', '누수 보수', '누수 보수'])
  })
})

/**
 * ★★ 현장 주 동선 전체. 2026-07-30 에 **찍은 3장이 전부 틀리게 저장되던** 흐름 그대로다.
 * 표가 «현재 사진 편집기» 로 동작해서, 다음 집 값을 넣는 순간 직전 사진이 덮어써졌다.
 */
describe('★★ 현장 주 동선 — 101호 전/후 찍고 102호로 옮기기', () => {
  const 찍힌값 = (s: State) =>
    s.photos.map((p) => `${p.fields.danji}/${p.fields.ho}/${p.fields.phase}`)

  it('세 장 모두 찍을 당시의 값을 그대로 지킨다', () => {
    let s = run(
      initialState,
      { type: 'setValue', key: 'ho', value: '101호' },
      { type: 'setValue', key: 'phase', value: '작업 전' },
      shot(), // ① 101호 작업 전
      { type: 'setValue', key: 'phase', value: '작업 후' }, // ② 다음 장을 위해 전→후
      shot(), // ③ 101호 작업 후
    )
    // ②에서 1번 사진이 '작업 후' 로 바뀌던 것이 이 버그였다
    expect(찍힌값(s)).toEqual(['행복아파트/101호/작업 전', '행복아파트/101호/작업 후'])

    s = run(
      s,
      { type: 'setValue', key: 'ho', value: '102호' }, // ④ 다음 집
      { type: 'setValue', key: 'danji', value: '새아파트' }, // ⑤ 단지도 바뀜
      shot(), // ⑥
    )
    expect(찍힌값(s)).toEqual([
      '행복아파트/101호/작업 전',
      '행복아파트/101호/작업 후',
      '새아파트/102호/작업 후', // 옛 단지가 붙던 것도 이 버그였다
    ])
  })
})

describe('일괄 되돌리기', () => {
  it('되돌리면 이전 값으로 돌아온다', () => {
    const s = run(
      withPhotos(3),
      { type: 'bulk', key: 'work', value: '도배', range: 'all' },
      { type: 'undoBulk' },
    )
    expect(workOf(s)).toEqual(['누수 보수', '누수 보수', '누수 보수'])
    expect(s.snack?.msg).toBe('3장 되돌림')
  })

  it('★ 일괄 뒤에 개별로 고친 사진은 침범하지 않는다', () => {
    const s = run(
      withPhotos(3),
      { type: 'bulk', key: 'work', value: '도배', range: 'all' },
      { type: 'goto', index: 1 },
      { type: 'mode', mode: 'edit' }, // 그 사진을 고르고 "이 사진을 고칩니다" 를 택한 상태
      { type: 'setValue', key: 'work', value: '내가 직접 고침' }, // 일괄 뒤 개별 수정
      { type: 'undoBulk' },
    )
    expect(workOf(s)).toEqual(['누수 보수', '내가 직접 고침', '누수 보수'])
    expect(s.snack?.msg).toContain('2장 되돌림')
    expect(s.snack?.msg).toContain('1장은 그 뒤 직접 고쳐서 그대로 둠')
  })

  it('되돌리기는 직전 1건만 남는다', () => {
    const s = run(
      withPhotos(2),
      { type: 'bulk', key: 'work', value: '도배', range: 'all' },
      { type: 'undoBulk' },
    )
    expect(s.bulkUndo).toBeNull()
    expect(reducer(s, { type: 'undoBulk' })).toBe(s) // 두 번째는 아무 일도 없다
  })

  it('스낵바가 되돌리기 액션을 실어 나른다', () => {
    const s = run(withPhotos(2), { type: 'bulk', key: 'work', value: '도배', range: 'all' })
    expect(s.snack?.undo).toEqual({ type: 'undoBulk' })
  })
})

describe('삭제와 되돌리기', () => {
  it('지우면 휴지통으로 가고 되돌리면 원래 자리로 온다', () => {
    const removed = run(withPhotos(3), { type: 'goto', index: 1 }, { type: 'remove' })
    expect(removed.photos).toHaveLength(2)
    expect(removed.trash).toHaveLength(1)
    expect(removed.snack?.undo).toEqual({ type: 'restoreRemoved' })

    const back = reducer(removed, { type: 'restoreRemoved' })
    expect(back.photos).toHaveLength(3)
    expect(back.trash).toHaveLength(0)
    expect(back.photos[1].id).toBe(removed.trash[0].id) // 같은 자리
  })

  it('사진이 없으면 안내만 한다', () => {
    const s = reducer(initialState, { type: 'remove' })
    expect(s.snack?.msg).toBe('삭제할 사진이 없습니다')
    expect(s.photos).toHaveLength(0)
  })
})

describe('찾기', () => {
  it('양 끝에서는 더 안 움직인다 (순환 없음)', () => {
    const s = withPhotos(3)
    expect(reducer(s, { type: 'move', delta: 1 }).cur).toBe(2)
    expect(run(s, { type: 'goto', index: 0 }, { type: 'move', delta: -1 }).cur).toBe(0)
  })
})

describe('표 항목 관리 (순서·추가·폴더/파일명 지정)', () => {
  const order = (s: State) => [...s.form].sort((a, b) => a.order - b.order).map((r) => r.key)

  it('항목을 위아래로 옮긴다', () => {
    const s = reducer(initialState, { type: 'moveRow', key: 'worker', delta: -1 })
    expect(order(s).slice(-2)).toEqual(['worker', 'date'])
  })

  it('맨 끝에서 더 내리거나 맨 앞에서 더 올리면 그대로다', () => {
    expect(reducer(initialState, { type: 'moveRow', key: 'worker', delta: 1 })).toBe(initialState)
    expect(reducer(initialState, { type: 'moveRow', key: 'danji', delta: -1 })).toBe(initialState)
  })

  it('항목을 추가하면 key 는 기계가 만든다 (사람이 못 정한다)', () => {
    const s = reducer(initialState, { type: 'addRow', label: '비고' })
    const added = s.form.at(-1)!
    expect(added).toMatchObject({ key: 'custom1', label: '비고', kind: 'slate', on: true, req: false })
    expect(order(s).at(-1)).toBe('custom1')
  })

  it('추가한 key 는 겹치지 않는다', () => {
    const s = run(initialState, { type: 'addRow', label: '비고' }, { type: 'addRow', label: '검측자' })
    expect(s.form.map((r) => r.key).filter((k) => k.startsWith('custom'))).toEqual([
      'custom1',
      'custom2',
    ])
  })

  it('빈 이름으로는 추가되지 않는다', () => {
    expect(reducer(initialState, { type: 'addRow', label: '   ' })).toBe(initialState)
  })

  it('폴더명·파일명 지정을 켜고 끈다', () => {
    const on = reducer(initialState, { type: 'togglePathKey', which: 'folderKeys', key: 'work' })
    expect(on.cfg.folderKeys).toEqual(['danji', 'ho', 'work'])
    const off = reducer(on, { type: 'togglePathKey', which: 'folderKeys', key: 'work' })
    expect(off.cfg.folderKeys).toEqual(['danji', 'ho'])
  })

  it('초기화하면 항목과 저장 설정이 처음으로 돌아간다', () => {
    const messed = run(
      initialState,
      { type: 'addRow', label: '비고' },
      { type: 'togglePathKey', which: 'fileKeys', key: 'loc' },
      { type: 'setCfg', patch: { histCount: 10 } },
    )
    const s = reducer(messed, { type: 'resetForm' })
    expect(s.form.map((r) => r.key)).toEqual(initialState.form.map((r) => r.key))
    expect(s.cfg).toEqual(initialState.cfg)
  })

  it('초기화해도 찍은 사진은 안 지운다', () => {
    const s = reducer(withPhotos(2), { type: 'resetForm' })
    expect(s.photos).toHaveLength(2)
  })
})

describe('서식 관리', () => {
  it('필수 항목은 끌 수 없다', () => {
    const s = reducer(initialState, { type: 'toggleRow', key: 'ho' })
    expect(s.form.find((r) => r.key === 'ho')?.on).toBe(true)
  })

  it('꺼진 항목은 켤 수 있다', () => {
    const s = reducer(initialState, { type: 'toggleRow', key: 'loc' })
    expect(s.form.find((r) => r.key === 'loc')?.on).toBe(true)
  })

  it('이름을 바꿔도 key 는 그대로다', () => {
    const s = reducer(initialState, { type: 'renameRow', key: 'worker', label: '담당자' })
    const row = s.form.find((r) => r.key === 'worker')
    expect(row?.label).toBe('담당자')
    expect(row?.key).toBe('worker')
  })

  it('기본값을 바꿔도 이미 찍은 사진은 안 바뀐다', () => {
    const s = run(withPhotos(2), { type: 'setDefault', key: 'worker', value: '김철수' })
    expect(s.photos.every((p) => p.fields.worker === '홍길동')).toBe(true)
    expect(reducer(s, shot()).photos[2].fields.worker).toBe('김철수')
  })

  it('구분(작업 전/후)은 선택이라 끌 수 있다', () => {
    const s = reducer(initialState, { type: 'toggleRow', key: 'phase' })
    expect(s.form.find((r) => r.key === 'phase')?.on).toBe(false)
  })
})

/**
 * ★ 저장된 서식이 코드 변경을 막지 않는다.
 *
 * 서식은 통째로 저장되므로 그냥 복원하면 **기본 서식을 고쳐도 이미 쓰던 사람에게는 영영 반영되지 않는다.**
 * 실제로 `구분`을 선택으로 바꿨는데 폰에서는 필수 그대로였다 (2026-07-30).
 * 코드가 정하는 것과 사용자가 정한 것의 경계를 이 테스트가 지킨다.
 */
describe('복원(hydrate)', () => {
  /** 예전에 저장된 서식 — 그때는 구분이 필수였고, 사용자는 이름을 바꾸고 꺼 뒀다 */
  const 예전저장분 = {
    form: initialState.form.map((r) =>
      r.key === 'phase' ? { ...r, req: true, label: '전/후', on: false } : r,
    ),
    style: initialState.style,
    cfg: initialState.cfg,
    slate: initialState.slate,
    history: {},
  }
  const hydrated = reducer(initialState, {
    type: 'hydrate',
    photos: [],
    trash: [],
    settings: 예전저장분,
  })
  const phase = hydrated.form.find((r) => r.key === 'phase')!

  it('코드가 정하는 것(req)은 코드를 따른다', () => {
    expect(phase.req).toBe(false)
  })

  it('사용자가 정한 것(label·on)은 저장분을 지킨다', () => {
    expect(phase.label).toBe('전/후')
    expect(phase.on).toBe(false)
  })
})
