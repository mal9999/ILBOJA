/**
 * 표 렌더러 — core 순수 함수. 전 플랫폼 공유.
 * 이관: 04.mock/기술검증-스파이크.html `drawStamp` (한글·속도 검증 통과분)
 * 정본: 03.화면-표준스펙.md §2.9
 *
 * 스파이크와 달라진 점 — **색을 뒤집었다.**
 * 스파이크는 검정 반투명 배경 + 흰 글씨였는데, 최종 산출물이 인쇄물·엑셀 삽입물이라
 * 스펙은 흰 배경 + 검은 글씨 + 검은 테두리로 정했다(경쟁 앱도 이 형태).
 * 그리고 값 열 **정렬** 옵션을 더했다 — 경쟁 앱 최다 요청(51명)이었던 것.
 *
 * 기하(글자 크기·여백·행 높이·말줄임)는 검증된 스파이크 계산을 그대로 쓴다.
 */

/** 표를 그릴 자리. `b`ottom/`t`op + `l`eft/`r`ight */
export type StampPos = 'tl' | 'tr' | 'bl' | 'br'

/** 배경 처리 (00.요구사항 §6.3) */
export type StampBg =
  | 'white' // 흰 배경 + 검은 테두리 (기본. 인쇄·엑셀 표준)
  | 'transparent' // 배경 없음 + 검은 테두리
  | 'none' // 배경도 테두리도 없음

export interface StampStyle {
  pos: StampPos
  bg: StampBg
  /** 값 열 정렬 */
  align: 'left' | 'center' | 'right'
  /** 글자 크기 = 이미지 폭 × 이 비율 */
  fontRatio: number
  /** 바깥 여백 = 이미지 폭 × 이 비율 */
  marginRatio: number
}

export const DEFAULT_STYLE: StampStyle = {
  pos: 'bl',
  bg: 'white',
  align: 'center',
  fontRatio: 0.026,
  marginRatio: 0.02,
}

export interface StampRow {
  label: string
  value: string
}

/**
 * `renderStamp` 가 쓰는 캔버스 기능만 추린 것.
 * `CanvasRenderingContext2D` 가 그대로 들어맞고, 테스트에서는 가짜를 넣는다.
 */
export interface StampCtx {
  font: string
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  textBaseline: CanvasTextBaseline
  save(): void
  restore(): void
  measureText(text: string): { width: number }
  fillRect(x: number, y: number, w: number, h: number): void
  strokeRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  stroke(): void
}

export interface StampResult {
  boxW: number
  boxH: number
  /** 실제 적용된 글자 크기(px) */
  fontSize: number
  /** 그려진 행 수 (빈 값 제외 후) */
  rows: number
}

const FONT_STACK = `'Malgun Gothic','Noto Sans KR','Apple SD Gothic Neo',sans-serif`
const INK = '#000'
const PAPER = '#fff'

/**
 * 사진 위에 표를 그린다. 원본 픽셀은 건드리지 않는다 — 이 함수는 렌더 시점에만 불린다.
 *
 * @param W,H 그릴 대상 캔버스 크기. 글자·여백이 여기에 비례한다
 */
export function renderStamp(
  c: StampCtx,
  W: number,
  H: number,
  rows: StampRow[],
  style: StampStyle = DEFAULT_STYLE,
): StampResult {
  const fs = Math.max(11, Math.round(W * style.fontRatio))
  const pad = Math.round(fs * 0.55)
  const rowH = Math.round(fs * 1.75)
  const gap = Math.round(fs * 0.9)
  const mg = Math.round(W * style.marginRatio)
  const font = `${fs}px ${FONT_STACK}`

  // 빈 값 행은 표에서 자동 제외 (00.요구사항 §5 검증 완료 항목)
  const R = rows.filter((r) => String(r.value).trim() !== '')
  if (!R.length) return { boxW: 0, boxH: 0, fontSize: fs, rows: 0 }

  c.font = font
  let wL = 0
  let wR = 0
  for (const r of R) {
    wL = Math.max(wL, c.measureText(r.label).width)
    wR = Math.max(wR, c.measureText(String(r.value)).width)
  }

  // 값이 길어도 이미지 밖으로 안 나가게
  const maxW = W - mg * 2 - pad * 2 - gap
  if (wL + wR > maxW) wR = Math.max(60, maxW - wL)

  const boxW = Math.ceil(wL + wR + gap + pad * 2)
  const boxH = rowH * R.length + pad * 2
  const x = style.pos[1] === 'l' ? mg : W - mg - boxW
  const y = style.pos[0] === 'b' ? H - mg - boxH : mg

  c.save()

  if (style.bg === 'white') {
    c.fillStyle = PAPER
    c.fillRect(x, y, boxW, boxH)
  }
  if (style.bg !== 'none') {
    c.strokeStyle = INK
    c.lineWidth = Math.max(1, fs * 0.05)
    c.strokeRect(x, y, boxW, boxH)
  }

  c.font = font
  c.textBaseline = 'middle'
  const colX = x + pad + wL + gap
  c.lineWidth = Math.max(1, fs * 0.035)

  if (style.bg !== 'none') {
    // 라벨 열과 값 열을 가르는 세로선
    c.strokeStyle = INK
    c.beginPath()
    c.moveTo(colX - gap / 2, y)
    c.lineTo(colX - gap / 2, y + boxH)
    c.stroke()
  }

  R.forEach((r, i) => {
    const cy = y + pad + rowH * i + rowH / 2

    if (i && style.bg !== 'none') {
      c.strokeStyle = INK
      c.beginPath()
      c.moveTo(x, cy - rowH / 2)
      c.lineTo(x + boxW, cy - rowH / 2)
      c.stroke()
    }

    c.fillStyle = INK
    c.fillText(r.label, x + pad, cy)

    // 값이 열 폭을 넘으면 말줄임
    let s = String(r.value)
    while (s.length > 1 && c.measureText(s).width > wR) s = s.slice(0, -2) + '…'

    const sw = c.measureText(s).width
    const vx =
      style.align === 'right'
        ? colX + wR - sw
        : style.align === 'center'
          ? colX + (wR - sw) / 2
          : colX
    c.fillText(s, vx, cy)
  })

  c.restore()
  return { boxW, boxH, fontSize: fs, rows: R.length }
}
