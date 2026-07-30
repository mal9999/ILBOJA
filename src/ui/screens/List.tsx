/**
 * S2 목록 (보조 — 점프용) (03 §4 S2).
 * 큰 사진 스와이프가 주 동선이다. 여기는 많을 때 건너뛰는 수단.
 * **작은 격자 금지** — 사진만 보고 고르지 않게 옆에 글자를 붙인다.
 */

import { useEffect, useRef } from 'react'
import { rowsForRender } from '../../core/models'
import { renderStamp, type StampStyle } from '../../core/renderStamp'
import { missingRequired } from '../../core/validate'
import { useStore } from '../state/store'
import { usePhotoImage } from '../state/images'
import type { FormRow, Photo } from '../../core/models'

export default function List() {
  const { state, dispatch } = useStore()

  /**
   * **단지 + 동/호수**로 묶는다.
   *
   * 호수만으로 묶으면 단지가 바뀌었을 때 **다른 아파트의 같은 호수가 한 덩어리가 된다** —
   * 현장에서 단지를 옮겨 다니므로 실제로 일어난다 (2026-07-30 사용자 지적).
   */
  const groups = new Map<string, { photo: Photo; index: number }[]>()
  state.photos.forEach((photo, index) => {
    const danji = photo.fields.danji?.trim()
    const ho = photo.fields.ho?.trim() || '동/호수 없음'
    const key = danji ? `${danji} · ${ho}` : ho
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push({ photo, index })
  })

  return (
    <>
      <div className="hd">
        <button className="icob" onClick={() => dispatch({ type: 'go', screen: 'main' })}>
          ←
        </button>
        <h1>
          사진 <span style={{ color: 'var(--dim)', fontWeight: 400 }}>{state.photos.length}장</span>
        </h1>
      </div>

      <div className="body">
        {!state.photos.length && <p className="note">아직 사진이 없습니다</p>}

        {[...groups].map(([where, items]) => (
          <div key={where}>
            <h3 style={{ fontSize: '0.94em', color: 'var(--dim)', margin: '14px 0 8px' }}>
              {where} · {items.length}장
            </h3>
            {items.map(({ photo, index }) => {
              const miss = missingRequired(state.form, photo.fields)
              return (
                <button
                  key={photo.id}
                  className="gcell"
                  onClick={() => dispatch({ type: 'goto', index })}
                >
                  <Thumb photo={photo} form={state.form} style={state.style} />
                  <span className="cap">
                    <b>{photo.fields.work || '작업내용 없음'}</b>
                    {/* 어느 집 사진인지가 먼저다. 전/후는 그 다음 (2026-07-30 사용자 지적) */}
                    <span>
                      {[
                        photo.fields.danji,
                        photo.fields.ho,
                        photo.fields.phase,
                        photo.fields.loc,
                      ]
                        .filter((v) => v?.trim())
                        .join(' · ') || '값 없음'}
                    </span>
                    {miss.length > 0 && <span className="warn">⚠ {miss.join(', ')} 미입력</span>}
                    {photo.rev > photo.exportedRev && photo.exportedRev > 0 && (
                      <span className="warn">📤 최신 아님</span>
                    )}
                  </span>
                  {miss.length > 0 && <span className="mk">⚠</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}

/**
 * 썸네일 — 촬영 때 만들어 둔 **320px 파일**을 그린다. 원본에서 그리면 목록을 여는 순간
 * 사진 전부를 펼치게 돼서 윈도우잉이 무효가 된다 (02 §4).
 *
 * **표를 합성해서 그린다.** 표 없이 사진만 보면 어느 게 어느 건지 구분이 안 된다 —
 * 목록의 존재 이유가 "많을 때 건너뛰기"인데 구분이 안 되면 쓸모가 없다.
 */
function Thumb({ photo, form, style }: { photo: Photo; form: FormRow[]; style: StampStyle }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const image = usePhotoImage(photo, 'thumb')

  // 크기는 메타로 안다 — 사진이 아직 안 왔어도 자리가 안 흔들린다
  const w = 320
  const h = Math.round((320 * photo.height) / photo.width)

  useEffect(() => {
    const cv = ref.current
    const c = cv?.getContext('2d')
    if (!cv || !c || !image) return
    cv.width = w
    cv.height = h
    c.drawImage(image, 0, 0, w, h)
    renderStamp(c, w, h, rowsForRender(form, photo.fields), style)
  }, [photo, image, form, style, w, h])

  return <canvas ref={ref} width={w} height={h} />
}
