/**
 * 안드로이드 **사진 불러오기.** 촬영은 여기가 아니라 앱 안 카메라(`platform/preview`)가 한다.
 *
 * 파일 입력(`<input type="file">`)은 WebView 가 "카메라/파일/갤러리" 선택 창을 먼저 띄워서
 * 한 단계가 더 든다. 터치 최소화가 이 앱의 핵심이라 그건 쓸 수 없다 (00 §6.1 "타이핑 제거", 01 §5).
 */

import { Camera, MediaTypeSelection } from '@capacitor/camera'
import { toCaptured } from '../image'
import { reason, type CameraPort, type PickedImage } from '../ports'

/** 취소는 실패가 아니다. 권한 거부 같은 진짜 문제와 갈라야 조용히 묻히지 않는다 */
function isCancel(e: unknown): boolean {
  const m = reason(e)
  return /cancel|취소/i.test(m)
}

/** 경로 하나를 "부르면 열리는 사진"으로. 여기서 열지 않는 게 핵심이다 (ports `PickedImage`) */
const lazy =
  (webPath: string): PickedImage =>
  async () =>
    toCaptured(await (await fetch(webPath)).blob())

export const nativeCamera: CameraPort = {
  async pickFromGallery() {
    try {
      /**
       * **`getPhoto` 는 여러 장을 못 준다.** 사용자가 갤러리에서 5장을 골라도 1장만 돌아왔다
       * (2026-07-30 실기기). 다중 선택은 `chooseFromGallery` 다.
       * (`getPhoto`·`pickImages` 는 플러그인 8 에서 deprecated)
       */
      const { results } = await Camera.chooseFromGallery({
        mediaType: MediaTypeSelection.Photo,
        allowMultipleSelection: true,
        limit: 0, // 0 = 제한 없음
      })
      return results.flatMap((r) => (r.webPath ? [lazy(r.webPath)] : []))
    } catch (e) {
      if (isCancel(e)) return [] // 취소
      throw e
    }
  },
}
