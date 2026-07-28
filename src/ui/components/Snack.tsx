/**
 * 스낵바 (03 §2.8) — 화면 상단, 8초 자동 소멸. 파괴적 작업은 반드시 되돌리기를 동반한다.
 */

import { useEffect } from 'react'
import { useStore } from '../state/store'

const AUTO_HIDE_MS = 8000

export default function Snack() {
  const { state, dispatch } = useStore()
  const snack = state.snack

  useEffect(() => {
    if (!snack) return
    const t = window.setTimeout(() => dispatch({ type: 'snack', snack: null }), AUTO_HIDE_MS)
    return () => window.clearTimeout(t)
  }, [snack, dispatch])

  if (!snack) return null

  return (
    <div className="snack">
      <span>{snack.msg}</span>
      {snack.undo && (
        <button
          onClick={() => {
            dispatch(snack.undo!)
          }}
        >
          되돌리기
        </button>
      )}
    </div>
  )
}
