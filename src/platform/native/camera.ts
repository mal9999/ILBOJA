/**
 * 안드로이드 카메라 — 누르면 **카메라가 바로 뜬다.**
 *
 * 파일 입력(`<input type="file" capture>`)은 WebView 가 선택 창을 먼저 띄워서,
 * 현장에서 한 장 찍을 때마다 "카메라/파일/갤러리" 중 고르기를 강요한다.
 * 터치 최소화가 이 앱의 핵심이라 그건 쓸 수 없다 (00 §6.1 "타이핑 제거", 01 §5).
 *
 * ⚠️ 남은 한계: `촬영`·`카메라전환` 이 **둘 다 폰 카메라 앱을 띄운다.** 원래 의도는
 * 앱 안 카메라(연속 촬영 1터치) + 시스템 카메라(광각·줌) 였는데, 앱 안 미리보기는
 * 별도 플러그인(`camera-preview`)이 있어야 한다. 연속 촬영 터치 수는 그때 줄어든다.
 */

import {
  Camera,
  CameraResultType,
  CameraSource,
  MediaTypeSelection,
} from '@capacitor/camera'
import { toCaptured } from '../image'
import type { CameraPort, PickedImage } from '../ports'

/** 취소는 실패가 아니다. 권한 거부 같은 진짜 문제와 갈라야 조용히 묻히지 않는다 */
function isCancel(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e)
  return /cancel|취소/i.test(m)
}

/** 경로 하나를 "부르면 열리는 사진"으로. 여기서 열지 않는 게 핵심이다 (ports `PickedImage`) */
const lazy =
  (webPath: string): PickedImage =>
  async () =>
    toCaptured(await (await fetch(webPath)).blob())

export const nativeCamera: CameraPort = {
  async capture(source) {
    try {
      if (source === 'gallery') {
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
      }

      const photo = await Camera.getPhoto({
        source: CameraSource.Camera,
        // base64 로 받으면 12MP 한 장이 문자열로 한 번 더 메모리에 올라간다.
        // Uri 로 받아 fetch 하면 바이트 그대로 Blob 이 된다 (02 §4)
        resultType: CameraResultType.Uri,
        quality: 92,
        correctOrientation: true,
        allowEditing: false,
        // 폰 갤러리에도 남긴다(2026-07-29 결정). 우리 원본은 앱 전용 영역에 있어서
        // **앱을 지우면 같이 사라진다** — 보고서 근거자료가 그렇게 날아가면 안 된다.
        // 갤러리에 가면 구글포토 백업에도 자동으로 실린다. 용량 두 벌은 그 값이다.
        saveToGallery: true,
      })
      return photo.webPath ? [lazy(photo.webPath)] : []
    } catch (e) {
      if (isCancel(e)) return [] // 취소
      throw e
    }
  },
}
