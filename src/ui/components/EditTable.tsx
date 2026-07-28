/**
 * 상단 편집 표 — 메인 전용, 동산형 핵심 (03 §2.2).
 *
 * 값은 사진에서(복사), 라벨은 서식에서(참조). auto 항목도 편집 가능하다 —
 * 설정을 고쳐도 과거 사진에 반영되지 않으므로(§3) 표가 유일한 수정 경로다.
 */

import { useRef } from 'react'
import type { FormRow } from '../../core/models'
import { previewFields, useStore } from '../state/store'

const LONG_PRESS_MS = 500

export default function EditTable() {
  const { state, dispatch } = useStore()
  const fields = previewFields(state)
  const noPhoto = state.photos.length === 0
  const rows = state.form.filter((r) => r.on).sort((a, b) => a.order - b.order)
  const timer = useRef<number | null>(null)
  const fired = useRef(false)

  const openInput = (row: FormRow) =>
    dispatch({
      type: 'sheet',
      // 사진이 없으면 auto 항목에는 고칠 대상이 없다 → 서식 기본값을 고친다.
      // 사진이 있으면 그 사진의 값을 고친다 (03 §2.2).
      sheet:
        noPhoto && row.kind === 'auto'
          ? { kind: 'default', key: row.key }
          : { kind: 'input', key: row.key },
    })

  const openBulk = (row: FormRow) => {
    if (state.photos.length < 2) return
    dispatch({
      type: 'sheet',
      sheet: { kind: 'bulk', key: row.key, value: fields[row.key] ?? '' },
    })
  }

  // 롱프레스 = 일괄의 보조 입구. 주 입구는 입력 시트 안의 버튼이다(고령 사용자는 롱프레스를 못 찾는다).
  // 탭은 onClick 으로 받는다 — 포인터 이벤트로만 처리하면 키보드·보조기기로 활성화가 안 된다.
  const holdStart = (row: FormRow) => {
    fired.current = false
    timer.current = window.setTimeout(() => {
      fired.current = true
      openBulk(row)
    }, LONG_PRESS_MS)
  }
  const clearHold = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
  }
  const tap = (row: FormRow) => {
    clearHold()
    if (fired.current) {
      fired.current = false // 롱프레스가 이미 처리했다
      return
    }
    openInput(row)
  }

  /** 촬영 전 작업일자는 고칠 게 없다 — 값이 촬영 시각으로 정해지기 때문 */
  const readOnly = (row: FormRow) => noPhoto && row.key === 'date'

  return (
    <div className="tbl">
      {rows.map((row) => {
        const value = fields[row.key] ?? ''
        const empty = row.req && !value.trim()

        return (
          <div className="r" key={row.key}>
            <div className="k">{row.label}</div>

            {row.kind === 'phase' ? (
              <div className="phase">
                {(['작업 전', '작업 후'] as const).map((v) => (
                  <button
                    key={v}
                    className={v === '작업 전' ? 'b' : 'a'}
                    aria-pressed={value === v}
                    onClick={() => dispatch({ type: 'setValue', key: row.key, value: v })}
                  >
                    {v}
                  </button>
                ))}
              </div>
            ) : readOnly(row) ? (
              <div className="v auto">
                <span className="txt">{value}</span>
              </div>
            ) : (
              <button
                className={`v ${row.kind === 'auto' ? 'auto' : ''} ${empty ? 'empty' : ''}`}
                onPointerDown={() => holdStart(row)}
                onPointerUp={clearHold}
                onPointerLeave={clearHold}
                onPointerCancel={clearHold}
                onClick={() => tap(row)}
              >
                <span className="txt">{value || (empty ? '입력 필요' : '눌러서 입력')}</span>
                {state.photos.length > 1 && (
                  <span
                    className="more"
                    role="presentation"
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      clearHold()
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      openBulk(row)
                    }}
                  >
                    여러 장
                  </span>
                )}
                <span aria-hidden>✏</span>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
