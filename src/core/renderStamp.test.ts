/**
 * 표 렌더러 테스트.
 * 캔버스 없이 돌린다 — `renderStamp` 는 `StampCtx` 인터페이스에만 의존하므로
 * 호출을 기록하는 가짜를 넣으면 Node 에서 그대로 검증된다.
 */

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STYLE,
  renderStamp,
  type StampCtx,
  type StampRow,
  type StampStyle,
} from './renderStamp'

interface TextCall {
  text: string
  x: number
  y: number
  color: string
}
interface RectCall {
  x: number
  y: number
  w: number
  h: number
  color: string
}

function fakeCtx() {
  const texts: TextCall[] = []
  const fillRects: RectCall[] = []
  const strokeRects: RectCall[] = []
  let strokes = 0

  const ctx: StampCtx & {
    texts: TextCall[]
    fillRects: RectCall[]
    strokeRects: RectCall[]
    strokes: () => number
  } = {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    textBaseline: 'alphabetic',
    save() {},
    restore() {},
    // 폭 = 글자수 × 글자크기의 절반. 실제 폰트 대신 쓰는 근사치
    measureText(text: string) {
      const fs = Number(/^(\d+)px/.exec(ctx.font)?.[1] ?? 10)
      return { width: text.length * fs * 0.5 }
    },
    fillRect(x, y, w, h) {
      fillRects.push({ x, y, w, h, color: ctx.fillStyle })
    },
    strokeRect(x, y, w, h) {
      strokeRects.push({ x, y, w, h, color: ctx.strokeStyle })
    },
    fillText(text, x, y) {
      texts.push({ text, x, y, color: ctx.fillStyle })
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {
      strokes++
    },
    texts,
    fillRects,
    strokeRects,
    strokes: () => strokes,
  }
  return ctx
}

const ROWS: StampRow[] = [
  { label: '단  지', value: '행복아파트' },
  { label: '동/호수', value: '101동 1502호' },
  { label: '작업내용', value: '누수 보수' },
  { label: '구  분', value: '작업 후' },
]

const style = (over: Partial<StampStyle> = {}): StampStyle => ({ ...DEFAULT_STYLE, ...over })

describe('renderStamp', () => {
  it('빈 값 행은 표에서 제외한다', () => {
    const c = fakeCtx()
    const r = renderStamp(c, 1920, 1440, [...ROWS, { label: '위  치', value: '   ' }])
    expect(r.rows).toBe(4)
    expect(c.texts.some((t) => t.text === '위  치')).toBe(false)
  })

  it('전부 비어 있으면 아무것도 그리지 않는다', () => {
    const c = fakeCtx()
    const r = renderStamp(c, 1920, 1440, [{ label: '단  지', value: '' }])
    expect(r).toMatchObject({ boxW: 0, boxH: 0, rows: 0 })
    expect(c.texts).toHaveLength(0)
    expect(c.fillRects).toHaveLength(0)
  })

  it('흰 배경 + 검은 글씨 + 검은 테두리 (인쇄·엑셀 표준)', () => {
    const c = fakeCtx()
    renderStamp(c, 1920, 1440, ROWS, style({ bg: 'white' }))
    expect(c.fillRects[0].color).toBe('#fff')
    expect(c.strokeRects[0].color).toBe('#000')
    expect(c.texts.every((t) => t.color === '#000')).toBe(true)
  })

  it("bg='transparent' 는 배경을 안 칠하고 테두리만 그린다", () => {
    const c = fakeCtx()
    renderStamp(c, 1920, 1440, ROWS, style({ bg: 'transparent' }))
    expect(c.fillRects).toHaveLength(0)
    expect(c.strokeRects).toHaveLength(1)
  })

  it("bg='none' 은 배경도 테두리도 선도 없이 글자만 그린다", () => {
    const c = fakeCtx()
    renderStamp(c, 1920, 1440, ROWS, style({ bg: 'none' }))
    expect(c.fillRects).toHaveLength(0)
    expect(c.strokeRects).toHaveLength(0)
    expect(c.strokes()).toBe(0)
    expect(c.texts.length).toBe(ROWS.length * 2) // 라벨 + 값
  })

  it('글자 크기는 이미지 폭에 비례한다 (기본 2.6%)', () => {
    const big = renderStamp(fakeCtx(), 1920, 1440, ROWS)
    const small = renderStamp(fakeCtx(), 640, 480, ROWS)
    expect(big.fontSize).toBe(Math.round(1920 * 0.026))
    expect(small.fontSize).toBe(Math.round(640 * 0.026))
  })

  it('아주 작은 이미지에서도 11px 밑으로는 안 내려간다', () => {
    expect(renderStamp(fakeCtx(), 100, 100, ROWS).fontSize).toBe(11)
  })

  it('위치 4모서리가 각각 다른 자리에 놓인다', () => {
    const at = (pos: StampStyle['pos']) => {
      const c = fakeCtx()
      renderStamp(c, 1920, 1440, ROWS, style({ pos }))
      return c.fillRects[0]
    }
    const bl = at('bl')
    const tr = at('tr')
    expect(bl.x).toBeLessThan(tr.x) // 좌 < 우
    expect(tr.y).toBeLessThan(bl.y) // 위 < 아래
    expect(at('tl').x).toBe(bl.x)
    expect(at('br').y).toBe(bl.y)
  })

  it('정렬이 값의 가로 위치를 바꾼다 (기본 중앙 — 경쟁앱 최다 요청)', () => {
    const valueX = (align: StampStyle['align']) => {
      const c = fakeCtx()
      renderStamp(c, 1920, 1440, ROWS, style({ align }))
      return c.texts.find((t) => t.text === '작업 후')!.x
    }
    expect(DEFAULT_STYLE.align).toBe('center')
    expect(valueX('left')).toBeLessThan(valueX('center'))
    expect(valueX('center')).toBeLessThan(valueX('right'))
  })

  it('값이 열 폭을 넘으면 말줄임한다', () => {
    const c = fakeCtx()
    renderStamp(c, 640, 480, [
      { label: '작업내용', value: '누수 보수' },
      { label: '비  고', value: '아주아주아주아주아주아주아주 긴 값이 들어온 경우'.repeat(4) },
    ])
    const long = c.texts.at(-1)!
    expect(long.text.endsWith('…')).toBe(true)
  })

  it('표가 이미지 밖으로 나가지 않는다', () => {
    const W = 640
    const H = 480
    const c = fakeCtx()
    renderStamp(c, W, H, [
      { label: '단  지', value: '가'.repeat(200) },
      { label: '동/호수', value: '나'.repeat(200) },
    ])
    const box = c.fillRects[0]
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.w).toBeLessThanOrEqual(W)
    expect(box.y + box.h).toBeLessThanOrEqual(H)
  })
})
