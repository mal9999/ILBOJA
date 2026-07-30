/**
 * 사진 스테이지 (03 §2.5) — 표가 합성된 사진. 좌우 스와이프 + ◀▶ 병행.
 * 찾기 배지(N/M장)는 별도 바가 아니라 스테이지 위 오버레이다(§2.4).
 *
 * 메인에서는 "찍혔다" 확인용이라 작아도 되고, 크게 보며 찾는 건 `onOpen` 으로
 * 들어가는 전체화면(Viewer)이 맡는다 (2026-07-29 정정). 같은 컴포넌트를 양쪽이 쓴다.
 */

import { useEffect, useRef, useState } from 'react'
import { rowsForRender } from '../../core/models'
import { renderStamp } from '../../core/renderStamp'
import { useStore } from '../state/store'
import { usePhotoImage } from '../state/images'

const SWIPE_PX = 60

export default function Stage({ onOpen }: { onOpen?: () => void }) {
  const { state, dispatch } = useStore()
  const ref = useRef<HTMLCanvasElement>(null)
  const [down, setDown] = useState<number | null>(null)
  /** 방금 넘긴 스와이프인가 — 스와이프 끝에 딸려 오는 click 을 탭으로 세면 안 된다 */
  const swiped = useRef(false)

  const photo = state.photos[state.cur]
  const has = state.photos.length > 0
  // 이미 줄여서 펼쳐진 것이 온다. 아직 준비 전이면 null (02 §4)
  const image = usePhotoImage(photo, 'original')

  useEffect(() => {
    const cv = ref.current
    const c = cv?.getContext('2d')
    if (!cv || !c || !photo || !image) return

    cv.width = image.width
    cv.height = image.height
    c.drawImage(image, 0, 0)
    renderStamp(c, cv.width, cv.height, rowsForRender(state.form, photo.fields), state.style)
  }, [photo, image, state.form, state.style])

  const move = (d: number) => dispatch({ type: 'move', delta: d })

  /** 사진을 탭하면 크게 본다. 스와이프 뒤에 따라오는 click 은 흘려보낸다 */
  const tap = () => {
    if (swiped.current) {
      swiped.current = false
      return
    }
    onOpen?.()
  }

  return (
    <div
      className="stage"
      onPointerDown={(e) => {
        setDown(e.clientX)
        swiped.current = false
      }}
      onPointerUp={(e) => {
        if (down === null) return
        const dx = e.clientX - down
        setDown(null)
        if (Math.abs(dx) > SWIPE_PX) {
          swiped.current = true
          move(dx < 0 ? 1 : -1)
        }
      }}
      onPointerLeave={() => setDown(null)}
    >
      {has ? (
        <>
          <canvas ref={ref} onClick={onOpen ? tap : undefined} />
          {!image && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                color: 'var(--dim)',
              }}
            >
              불러오는 중…
            </div>
          )}
          <div className="pos">
            {state.cur + 1} / {state.photos.length}장
          </div>
          {/* 탭만으로는 있는 줄 모르고 키보드·보조기기로도 못 연다 — 보이는 버튼을 같이 둔다 */}
          {onOpen && (
            <button className="zoom" onClick={onOpen}>
              ⤢ 크게
            </button>
          )}
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
