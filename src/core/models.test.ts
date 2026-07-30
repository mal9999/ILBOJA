/**
 * 데이터 모델 테스트.
 *
 * 여기서 제일 중요한 건 "설정을 바꿔도 과거 사진은 안 바뀐다"를 못 박는 것이다.
 * 목업(`app.html` `rowsOf`)이 auto 항목을 렌더 시점에 전역에서 읽는 바람에
 * 작업자를 바꾸면 과거 사진 표까지 소급 변경되고 날짜도 앱 켠 날로 밀렸다.
 * 그 버그가 되살아나면 이 파일이 먼저 깨진다.
 */

import { describe, expect, it } from 'vitest'
import { rowsForRender, snapshotFields, type Fields, type FormRow } from './models'
import { isComplete, missingRequired } from './validate'
import { DEFAULT_FORM } from './defaultForm'

const form = (): FormRow[] => DEFAULT_FORM.map((r) => ({ ...r }))

/** 사람이 넣는 값(slate) */
const base: Fields = { ho: '101동 1502호', work: '누수 보수', phase: '작업 후' }

describe('snapshotFields', () => {
  it('auto 항목까지 포함해 표 값 전부를 사진에 복사한다', () => {
    const f = form()
    f.find((r) => r.key === 'danji')!.default = '행복아파트'
    f.find((r) => r.key === 'worker')!.default = '홍길동'

    const fields = snapshotFields(f, base, { date: '2026-07-20' })

    expect(fields).toMatchObject({
      danji: '행복아파트',
      worker: '홍길동',
      date: '2026-07-20',
      ho: '101동 1502호',
      work: '누수 보수',
    })
  })

  it('★ 나중에 서식을 고쳐도 이미 찍은 사진은 안 바뀐다', () => {
    const f = form()
    f.find((r) => r.key === 'worker')!.default = '홍길동'

    const 어제사진 = snapshotFields(f, base, { date: '2026-07-20' })

    // 설정에서 작업자를 바꾸고 날짜도 지나감
    f.find((r) => r.key === 'worker')!.default = '김철수'
    const 오늘사진 = snapshotFields(f, base, { date: '2026-07-28' })

    expect(어제사진.worker).toBe('홍길동') // 소급 변경 없음
    expect(어제사진.date).toBe('2026-07-20')
    expect(오늘사진.worker).toBe('김철수')
  })

  it('autoValues 가 없으면 서식 기본값으로 떨어진다', () => {
    const f = form()
    f.find((r) => r.key === 'danji')!.default = '행복아파트'
    expect(snapshotFields(f, base).danji).toBe('행복아파트')
  })

  it('기본값도 값도 없으면 빈 문자열이지 undefined 가 아니다', () => {
    expect(snapshotFields(form(), {}).danji).toBe('')
    expect(snapshotFields(form(), {}).ho).toBe('')
  })

  it('꺼진 항목도 값은 실어둔다 — 나중에 켜면 살아나야 한다', () => {
    const f = form()
    expect(f.find((r) => r.key === 'loc')!.on).toBe(false)
    expect(snapshotFields(f, { ...base, loc: '거실 천장' }).loc).toBe('거실 천장')
  })
})

describe('rowsForRender', () => {
  it('값은 사진에서 읽는다 — 서식 기본값이 아니라', () => {
    const f = form()
    f.find((r) => r.key === 'worker')!.default = '김철수' // 지금 설정
    const fields = { ...snapshotFields(f, base), worker: '홍길동' } // 찍힐 때 값

    const worker = rowsForRender(f, fields).find((r) => r.label === '작 업 자')
    expect(worker?.value).toBe('홍길동')
  })

  it('라벨은 서식에서 읽는다 — 이름을 바꾸면 과거 사진에도 반영된다', () => {
    const f = form()
    const fields = snapshotFields(f, base, { date: '2026-07-20' })

    f.find((r) => r.key === 'worker')!.label = '담당자'
    fields.worker = '홍길동'

    const rows = rowsForRender(f, fields)
    expect(rows.some((r) => r.label === '담당자')).toBe(true)
    expect(rows.find((r) => r.label === '담당자')?.value).toBe('홍길동')
  })

  it('꺼진 항목과 빈 값 행은 표에서 빠진다', () => {
    const f = form()
    const rows = rowsForRender(f, snapshotFields(f, { ...base, loc: '거실 천장' }))
    expect(rows.some((r) => r.label === '위  치')).toBe(false) // loc 은 기본 꺼짐
    expect(rows.every((r) => r.value.trim() !== '')).toBe(true)
  })

  it('order 순서대로 나온다', () => {
    const f = form()
    f.find((r) => r.key === 'danji')!.default = '행복아파트'
    f.find((r) => r.key === 'worker')!.default = '홍길동'
    const rows = rowsForRender(f, snapshotFields(f, base, { date: '2026-07-28' }))
    expect(rows.map((r) => r.label)).toEqual([
      '단  지',
      '동/호수',
      '작업내용',
      '구  분',
      '작업일자',
      '작 업 자',
    ])
  })
})

describe('missingRequired', () => {
  it('필수인데 빈 항목의 라벨을 돌려준다', () => {
    const f = form()
    // 구분(작업 전/후)은 **선택**이다 — 전/후를 안 나누는 작업이 있어서 끌 수 있어야 한다 (2026-07-30)
    expect(missingRequired(f, snapshotFields(f, {}))).toEqual(['동/호수', '작업내용'])
  })

  it('촬영 게이트가 없으므로 미입력 사진이 생길 수 있다 — 그걸 잡아내는 게 이 함수다', () => {
    const f = form()
    const 찍고안채운사진 = snapshotFields(f, { phase: '작업 후' })
    expect(isComplete(f, 찍고안채운사진)).toBe(false)
    expect(missingRequired(f, 찍고안채운사진)).toEqual(['동/호수', '작업내용'])
  })

  it('다 채우면 통과한다', () => {
    const f = form()
    expect(isComplete(f, snapshotFields(f, base))).toBe(true)
  })

  it('꺼진 항목은 필수라도 안 따진다', () => {
    const f = form()
    f.find((r) => r.key === 'loc')!.req = true
    expect(isComplete(f, snapshotFields(f, base))).toBe(true)
  })
})
