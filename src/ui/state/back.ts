/**
 * 안드로이드 **뒤로가기** — 화면마다 «닫을 것»이 다르다.
 *
 * 이 앱은 라우터를 안 쓰고 상태 하나로 화면을 가른다(`AppShell`). 그래서 WebView 에는
 * 히스토리가 없고, 기본 동작이 곧 **앱 종료**다 — 목록을 보다 뒤로가기를 누르면 앱이 꺼졌다
 * (2026-08-03 사용자 지적).
 *
 * 덮개(시트·사용법·뷰어)는 화면이 아니라 **겹쳐진 것**이라, 무엇을 닫아야 하는지는
 * 그걸 띄운 쪽이 가장 잘 안다. 그래서 각자 «내가 열려 있으면 내가 닫는다»를 등록하고,
 * **가장 나중에 열린 것부터** 물어본다. 아무도 손들지 않으면 그때 화면을 뒤로 물린다.
 */

import { useEffect, useRef } from 'react'

/** 처리했으면 `true` — 그 위(먼저 열린 것)로는 안 내려간다 */
type Handler = () => boolean

const stack: Handler[] = []

/** 뒤로가기 한 번. 아무도 안 받으면 `false` (그때가 앱을 끌 자리다) */
export function runBack(): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]()) return true
  }
  return false
}

/**
 * `active` 인 동안만 뒤로가기를 받는다.
 *
 * 함수는 ref 로 들고 있어서 **매 렌더마다 등록/해제를 반복하지 않는다** — 그러면 순서가
 * 뒤집혀 시트보다 화면 전환이 먼저 잡힌다.
 */
export function useBackHandler(active: boolean, fn: Handler): void {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (!active) return
    const h: Handler = () => ref.current()
    stack.push(h)
    return () => {
      const i = stack.indexOf(h)
      if (i >= 0) stack.splice(i, 1)
    }
  }, [active])
}
