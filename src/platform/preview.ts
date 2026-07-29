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
       * 우리 화면이 프리뷰 **위에** 그려져야 한다.
       * 프리뷰를 앞에 두면 ① 입력 시트가 가려져 표를 못 고치고
       * ② 프리뷰를 탭해 큰 이미지 갤러리로 들어가는 길이 막힌다.
       */
      toBack: true,
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

  async shoot() {
    if (!running) return null
    // quality 를 주면 JPEG 로 나온다(안 주면 웹 구현이 PNG 를 뱉는다)
    const { value } = await CameraPreview.capture({ quality: 92 })
    if (!value) return null
    const blob = await (await fetch(`data:image/jpeg;base64,${value}`)).blob()
    return toCaptured(blob)
  },
}
