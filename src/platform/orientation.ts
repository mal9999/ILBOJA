/**
 * 화면 방향 — **앱은 세로 고정, 촬영 화면만 예외** (사용자 확인, 2026-08-03).
 *
 * 앱 화면(메인·입력·목록…)은 세로로만 쓴다. 그래서 `AndroidManifest.xml` 의 MainActivity 를
 * `screenOrientation="portrait"` 로 잠갔다. 그런데 **사진은 눕혀 찍는다** — 세로로 잠긴 채
 * 촬영하면 폰을 눕혀 들어도 늘 세로 사진이 나온다. 촬영 회전이 액티비티 표시 방향을 따르기 때문이다.
 *
 * 그래서 촬영 화면에서만 센서를 따르게 한다. 안드로이드 쪽 구현은
 * `android/app/src/main/java/kr/ilboja/app/OrientationPlugin.java` 에 있다 —
 * `camera-preview` 플러그인은 «잠근다»만 제공하고 «센서를 따르라»는 길이 없어서 직접 만들었다.
 */

import { registerPlugin } from '@capacitor/core'

interface OrientationPlugin {
  /** 폰을 돌리는 대로 따라간다. **시스템의 「자동회전 끄기」도 덮어쓴다** */
  followSensor(): Promise<void>
  /** 앱 기본값인 세로로 되돌린다 */
  lockPortrait(): Promise<void>
}

/**
 * PC 브라우저에는 돌릴 화면이 없다 — 아무 일도 안 한다.
 * 이 대체 구현이 없으면 개발 중 촬영 화면이 «구현되지 않음» 오류로 튕긴다.
 */
export const orientation = registerPlugin<OrientationPlugin>('Orientation', {
  web: () => ({
    followSensor: async () => {},
    lockPortrait: async () => {},
  }),
})
