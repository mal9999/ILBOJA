/**
 * 큰 사진 스테이지 (03 §2.5) — 표가 합성된 큰 사진. 좌우 스와이프 + ◀▶ 병행.
 * 찾기 배지(N/M장)는 별도 바가 아니라 스테이지 위 오버레이다(§2.4).
 */

import { useEffect, useRef, useState } from 'react'
import { rowsForRender } from '../../core/models'
import { renderStamp } from '../../core/renderStamp'
import { useStore } from '../state/store'

const SWIPE_PX = 60

export default function Stage() {
  const { state, dispatch } = useStore()
  const ref = useRef<HTMLCanvasElement>(null)
  const [down, setDown] = useState<number | null>(null)

  const photo = state.photos[state.cur]
  const has = state.photos.length > 0

  useEffect(() => {
    const cv = ref.current
    const c = cv?.getContext('2d')
    if (!cv || !c || !photo) return

    // 긴 변 1920 로 줄여 그린다. 원본 비트맵을 그대로 들면 저가폰이 죽는다(실측 100장 = 4,651MB)
    const k = Math.min(1, 1920 / Math.max(photo.width, photo.height))
    const W = Math.round(photo.width * k)
    const H = Math.round(photo.height * k)
    cv.width = W
    cv.height = H

    c.drawImage(photo.image, 0, 0, W, H)
    renderStamp(c, W, H, rowsForRender(state.form, photo.fields), state.style)
  }, [photo, state.form, state.style])

  const move = (d: number) => dispatch({ type: 'move', delta: d })

  return (
    <div
      className="stage"
      onPointerDown={(e) => setDown(e.clientX)}
      onPointerUp={(e) => {
        if (down === null) return
        const dx = e.clientX - down
        setDown(null)
        if (Math.abs(dx) > SWIPE_PX) move(dx < 0 ? 1 : -1)
      }}
      onPointerLeave={() => setDown(null)}
    >
      {has ? (
        <>
          <canvas ref={ref} />
          <div className="pos">
            {state.cur + 1} / {state.photos.length}장
          </div>
          <button className="sw l" disabled={state.cur === 0} onClick={() => move(-1)}>
            ◀
          </button>
          <button
            className="sw r"
            disabled={state.cur >= state.photos.length - 1}
            onClick={() => move(1)}
          >
            ▶
          </button>
          <div className="safe">🔒 원본은 그대로 보관됩니다 · 표는 언제든 고칠 수 있어요</div>
        </>
      ) : (
        <div className="empty">
          <b>📷 촬영</b> 또는 좌측 <b>보드판서식 › 불러오기</b>
          <br />로 사진을 추가하세요
          <br />
          <br />
          사진은 여기 크게 나오고
          <br />◀ ▶ 로 넘기며 바로 고칩니다
          <br />
          (작은 갤러리에서 찾을 필요 없음)
          <div className="pos">사진 없음</div>
        </div>
      )}
    </div>
  )
}
