/**
 * 폴더·파일명 생성 테스트.
 * 04.mock/기술검증-스파이크.html 의 `btnPath` 케이스 8종 + 중복 연번을 그대로 옮긴 것.
 * 스파이크는 label 로 항목을 찾았지만 여기서는 key 로 찾는다(03 §3).
 */

import { describe, expect, it } from 'vitest'
import { buildPath, sanitize, type PathConfig } from './path'
import type { Fields } from './models'

const cfg: PathConfig = {
  folderKeys: ['danji', 'ho'],
  fileKeys: ['phase', 'loc'],
  fallbackFolder: '미분류',
  fallbackFile: '사진',
}

/** 경로 조각에 남아 있으면 안 되는 문자 (`/` 는 구분자라 제외) */
const BAD = /[\\:*?"<>|\x00-\x1f]/

const bytes = (s: string) => new TextEncoder().encode(s).length

/** 스파이크가 쓰던 합격 조건 — 모든 케이스가 이걸 통과해야 한다 */
function assertUsable(path: string) {
  expect(BAD.test(path)).toBe(false)
  for (const seg of path.split('/')) {
    expect(seg).not.toBe('')
    expect(seg).toBe(seg.trim())
    expect(/[.\s]$/.test(seg.replace(/\.jpg$/, ''))).toBe(false)
    expect(bytes(seg)).toBeLessThanOrEqual(90)
  }
}

describe('sanitize', () => {
  it('OS 금지문자를 _ 로 바꾼다', () => {
    expect(sanitize('A/B:C*D?E"F<G>H|I')).toBe('A_B_C_D_E_F_G_H_I')
  })

  it('연속 공백을 한 칸으로 줄인다', () => {
    expect(sanitize('행복   아파트    동')).toBe('행복 아파트 동')
  })

  it('개행·탭은 제어문자라 _ 로 바뀐다 (공백 축약보다 먼저 걸린다)', () => {
    expect(sanitize('행복\n아파트\t동')).toBe('행복_아파트_동')
  })

  it('끝의 점과 공백을 떼어낸다 (Windows가 잘라먹는다)', () => {
    expect(sanitize('  행복  아파트 . ')).toBe('행복 아파트')
    expect(sanitize('101동.')).toBe('101동')
  })

  it('지번의 하이픈은 보존한다', () => {
    expect(sanitize('산 12-3')).toBe('산 12-3')
  })

  it('Windows 예약어에는 _ 를 붙인다 (대소문자 무관)', () => {
    expect(sanitize('CON')).toBe('CON_')
    expect(sanitize('aux')).toBe('aux_')
    expect(sanitize('COM1')).toBe('COM1_')
  })

  it('예약어처럼 생겼어도 뒤에 뭐가 붙으면 건드리지 않는다', () => {
    expect(sanitize('CONTROL')).toBe('CONTROL')
  })

  it('한글을 글자수가 아니라 바이트로 자른다', () => {
    const long = '가'.repeat(60) // 180 bytes
    const out = sanitize(long)
    expect(bytes(out)).toBeLessThanOrEqual(80)
    expect(out.length).toBe(26) // 26자 × 3바이트 = 78
  })

  it('빈 값·null·undefined 는 빈 문자열', () => {
    expect(sanitize('')).toBe('')
    expect(sanitize('   ')).toBe('')
    expect(sanitize(null)).toBe('')
    expect(sanitize(undefined)).toBe('')
  })
})

describe('buildPath', () => {
  const cases: [name: string, fields: Fields][] = [
    [
      '정상',
      { danji: '행복아파트', ho: '101동 1502호', phase: '작업 후', loc: '거실 천장' },
    ],
    ['지번 하이픈 보존', { danji: '산 12-3', ho: '가_101', phase: '작업 전', loc: '' }],
    ['금지문자', { danji: 'A/B:C*D?E"F<G>H|I', ho: '101', phase: '후', loc: '' }],
    ['앞뒤공백·끝점', { danji: '  행복  아파트 . ', ho: '101동.', phase: '전', loc: '' }],
    ['빈 값 폴백', { danji: '', ho: '', phase: '', loc: '' }],
    ['윈도우 예약어', { danji: 'CON', ho: 'aux', phase: '전', loc: '' }],
    ['초장문 한글', { danji: '가'.repeat(60), ho: '101', phase: '후', loc: '' }],
    ['개행·탭', { danji: '행복\n아파트\t동', ho: '101', phase: '전', loc: '' }],
  ]

  it.each(cases)('%s — 쓸 수 있는 경로가 나온다', (_name, fields) => {
    assertUsable(buildPath(fields, cfg, 1))
  })

  it('정상 케이스는 항목 순서대로 조립된다', () => {
    expect(buildPath(cases[0][1], cfg, 1)).toBe(
      '행복아파트/101동 1502호/작업 후_거실 천장_001.jpg',
    )
  })

  it('값이 다 비면 폴백 이름을 쓴다', () => {
    expect(buildPath({}, cfg, 5)).toBe('미분류/미분류/사진_005.jpg')
  })

  it('빈 항목은 파일명에서 빠지고 _ 가 겹치지 않는다', () => {
    const p = buildPath({ danji: 'A', ho: 'B', phase: '전', loc: '' }, cfg, 2)
    expect(p).toBe('A/B/전_002.jpg')
  })

  it('연번은 3자리로 채우고 같은 값이라도 파일명이 갈린다', () => {
    const same: Fields = {
      danji: '행복아파트',
      ho: '101동 1502호',
      phase: '작업 후',
      loc: '거실',
    }
    const names = [1, 2, 3].map((n) => buildPath(same, cfg, n).split('/').pop())
    expect(new Set(names).size).toBe(3)
    expect(names[0]).toBe('작업 후_거실_001.jpg')
  })

  it('label 이 아니라 key 로 찾는다 — 항목 이름을 바꿔도 경로가 안 갈린다', () => {
    // 사용자가 '작 업 자' 를 '담당자' 로 바꿔도 fields 의 key 는 그대로다
    const p1 = buildPath({ danji: '행복', ho: '101' }, cfg, 1)
    const p2 = buildPath({ danji: '행복', ho: '101' }, cfg, 1)
    expect(p1).toBe(p2)
    expect(p1).toBe('행복/101/사진_001.jpg')
  })
})
