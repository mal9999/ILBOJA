/**
 * 안드로이드(APK)용 어댑터 모음.
 *
 * 갈아 끼우는 건 셋 — 카메라·사진 바이트 저장(`db`)·내보내기(`share`).
 * 작은 값(`storage`)은 localStorage 로 충분하다. 억지로 네이티브로 바꾸면 브라우저 개발 루프만 잃는다.
 *
 * 카메라는 처음에 파일 입력을 그대로 썼다가 **실기기에서 못 쓴다는 게 드러나 교체**했다 —
 * WebView 가 카메라를 바로 안 띄우고 선택 창을 먼저 띄운다(2026-07-29).
 */

import type { Ports } from '../ports'
import { webStorage } from '../web'
import { nativeCamera } from './camera'
import { nativeDb } from './db'
import { nativeShare } from './share'

export const nativePorts: Ports = {
  camera: nativeCamera,
  storage: webStorage,
  db: nativeDb,
  share: nativeShare,
}
