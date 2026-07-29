/**
 * 안드로이드(APK)용 어댑터 모음.
 *
 * **갈아 끼우는 건 두 개뿐이다** — 사진 바이트 저장(`db`)과 내보내기(`share`).
 * 카메라는 WebView 에서도 `<input type="file" capture>` 가 카메라 앱을 띄우므로 그대로 쓰고
 * (Capacitor Camera 플러그인은 단계 5), 작은 값은 localStorage 로 충분하다.
 * 나머지를 억지로 네이티브로 바꾸면 브라우저 개발 루프만 잃는다.
 */

import type { Ports } from '../ports'
import { webCamera } from '../web/camera'
import { webStorage } from '../web'
import { nativeDb } from './db'
import { nativeShare } from './share'

export const nativePorts: Ports = {
  camera: webCamera,
  storage: webStorage,
  db: nativeDb,
  share: nativeShare,
}
