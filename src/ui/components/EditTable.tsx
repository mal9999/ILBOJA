/**
 * 상단 편집 표 — 메인 전용, 동산형 핵심 (03 §2.2).
 *
 * 값은 사진에서(복사), 라벨은 서식에서(참조). auto 항목도 편집 가능하다 —
 * 설정을 고쳐도 과거 사진에 반영되지 않으므로(§3) 표가 유일한 수정 경로다.
 */

import { useRef } from 'react'
import { PHASES, type FormRow } from '../../core/models'
import { previewFields, useStore } from '../state/store'

const LONG_PRESS_MS = 500

export default function EditTable() {
  const { state, dispatch } = useStore()
  const fields = previewFields(state)
  const rows = state.form.filter((r) => r.on).sort((a, b) => a.order - b.order)
  const timer = useRef<number | null>(null)
  const fired = useRef(false)

  /**
   * 표를 고치면 **어디로 갈지는 표 위 스위치가 이미 정해 놨다** (2026-07-31).
   *
   * 묻지 않는다 — 주 동선에서 100번 반복되는 확인창은 읽지 않고 누르게 되어 스스로를 무력화한다.
   * 기본은 언제나 안전한 쪽(새 사진용)이고, 찍은 사진을 고치는 건 사용자가 켠 동안만이다.
   *
   * 촬영 쪽의 auto 항목은 **서식 기본값**을 고친다. 그래야 다음 사진부터 새 단지가 붙는다 —
   * 사진 값만 고치면 다음 촬영 때 옛 기본값으로 되돌아갔다.
   */
  const openInput = (row: FormRow) =>
    dispatch({
      type: 'sheet',
      sheet:
        state.mode === 'shoot' && row.kind === 'auto'
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

  /** 촬영 준비 중인 작업일자는 고칠 게 없다 — 값이 촬영 시각으로 정해지기 때문 */
  const readOnly = (row: FormRow) => state.mode === 'shoot' && row.key === 'date'

  return (
    /*
     * 수정 모드에서는 **표 자체가** 달라 보인다 (2026-07-31).
     * 표 위 모드띠는 한 줄이라 햇빛 아래 현장에서 흘려보게 되는데, 정작 손이 닿는 건 표다.
     * 경고는 손 닿는 자리에 있어야 한다.
     */
    <div className={`tbl ${state.mode === 'edit' ? 'edit' : ''}`}>
      {rows.map((row) => {
        const value = fields[row.key] ?? ''
        const empty = row.req && !value.trim()

        return (
          <div className="r" key={row.key}>
            <div className="k">{row.label}</div>

            {row.kind === 'phase' ? (
              <div className="phase">
                {PHASES.map((v) => (
                  <button
                    key={v}
                    // 전=주황 · 중=파랑 · 후=초록. 색으로 진행 단계를 읽는다
                    className={v === '작업 전' ? 'b' : v === '작업 후' ? 'a' : 'm'}
                    aria-pressed={value === v}
                    // 가장 자주 눌리는 곳이다. 여기에 확인창을 놓으면 앱이 못 쓰게 된다
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
