/**
 * 앱 안 카메라 — 브라우저·안드로이드 공용 (`@capacitor-community/camera-preview`).
 *
 * 폰 카메라 앱으로 나가는 방식은 실기기에서 두 가지가 깨졌다 (2026-07-29):
 * 촬영해도 결과가 안 돌아오고, 카메라가 떠 있는 동안 안드로이드가 앱을 죽이면 통째로 사라진다(`03` §2.3).
 * 앱을 안 벗어나면 둘 다 생기지 않고, 표를 고치고 셔터를 누르는 반복이 장당 1터치가 된다.
 */

import { CameraPreview } from '@capacitor-community/camera-preview'
import { toCaptured } from './image'
import type { PreviewPort } from './ports'

/** 웹에서는 이 id 를 가진 요소 안에 `<video>` 가 들어간다 */
export const PREVIEW_PARENT = 'ilboja-preview'

let running = false

export const cameraPreview: PreviewPort = {
  async start(rect) {
    if (running) await cameraPreview.stop()
    await CameraPreview.start({
      position: 'rear',
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      /**
       * 프리뷰를 **앞에** 그린다.
       *
       * 처음엔 뒤에 그렸다(`toBack: true`). 우리 화면이 위에 오면 입력 시트도 가려지지 않고
       * 프리뷰를 탭해 큰 이미지로 들어가는 길도 열리기 때문이다. 그런데 그 방식은
       * **WebView 자체가 투명해야** 카메라가 비치고, 기기마다 다르다 —
       * 실기기에서 화면이 하얗게만 나왔다 (2026-07-29).
       *
       * 앞에 그리면 확실히 보인다. 대신 프리뷰가 아레나를 덮으므로,
       * 시트·사이드패널이 열릴 때는 프리뷰를 잠시 끈다(Main 이 관리).
       */
      toBack: false,
      parent: PREVIEW_PARENT,
      className: 'preview-video',
      disableAudio: true,
      lockAndroidOrientation: true,
    })
    running = true
  },

  async stop() {
    if (!running) return
    running = false
    try {
      await CameraPreview.stop()
    } catch {
      /* 이미 꺼져 있으면 그만이다 */
    }
  },

  async shoot(size) {
    if (!running) return null
    // quality 를 주면 JPEG 로 나온다(안 주면 웹 구현이 PNG 를 뱉는다).
    // 크기를 안 주면 기기가 최대치로 찍는다 — 설정의 「카메라 해상도」가 여기로 온다
    const { value } = await CameraPreview.capture({ quality: 92, ...size })
    if (!value) return null
    const blob = await (await fetch(`data:image/jpeg;base64,${value}`)).blob()
    return toCaptured(blob)
  },
}
