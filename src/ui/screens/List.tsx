/**
 * S2 목록 (보조 — 점프용) (03 §4 S2).
 * 큰 사진 스와이프가 주 동선이다. 여기는 많을 때 건너뛰는 수단.
 * **작은 격자 금지** — 사진만 보고 고르지 않게 옆에 글자를 붙인다.
 */

import { useEffect, useRef } from 'react'
import { rowsForRender } from '../../core/models'
import { renderStamp, type StampStyle } from '../../core/renderStamp'
import { missingRequired } from '../../core/validate'
import { useStore, type UiPhoto } from '../state/store'
import type { FormRow } from '../../core/models'

export default function List() {
  const { state, dispatch } = useStore()

  // 동/호수로 자동 묶음
  const groups = new Map<string, { photo: UiPhoto; index: number }[]>()
  state.photos.forEach((photo, index) => {
    const key = photo.fields.ho?.trim() || '—'
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

        {[...groups].map(([ho, items]) => (
          <div key={ho}>
            <h3 style={{ fontSize: '0.94em', color: 'var(--dim)', margin: '14px 0 8px' }}>
              {ho} · {items.length}장
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
                    <span>
                      {photo.fields.phase || '구분 없음'}
                      {photo.fields.loc ? ` · ${photo.fields.loc}` : ''}
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
 * 썸네일 — 원본이 아니라 축소본을 그린다(메모리 보호). 320px 캐시는 단계 4에서 파일로.
 *
 * **표를 합성해서 그린다.** 표 없이 사진만 보면 어느 게 어느 건지 구분이 안 된다 —
 * 목록의 존재 이유가 "많을 때 건너뛰기"인데 구분이 안 되면 쓸모가 없다.
 */
function Thumb({
  photo,
  form,
  style,
}: {
  photo: UiPhoto
  form: FormRow[]
  style: StampStyle
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    const c = cv?.getContext('2d')
    if (!cv || !c) return
    cv.width = 320
    cv.height = Math.round((320 * photo.height) / photo.width)
    c.drawImage(photo.image, 0, 0, cv.width, cv.height)
    renderStamp(c, cv.width, cv.height, rowsForRender(form, photo.fields), style)
  }, [photo, form, style])

  return <canvas ref={ref} />
}
