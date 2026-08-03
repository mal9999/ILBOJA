/**
 * 앱 안 카메라 — 브라우저·안드로이드 공용 (`@capacitor-community/camera-preview`).
 *
 * 폰 카메라 앱으로 나가는 방식은 실기기에서 두 가지가 깨졌다 (2026-07-29):
 * 촬영해도 결과가 안 돌아오고, 카메라가 떠 있는 동안 안드로이드가 앱을 죽이면 통째로 사라진다(`03` §2.3).
 * 앱을 안 벗어나면 둘 다 생기지 않는다.
 *
 * 이 프리뷰를 쓰는 곳은 **전체화면 촬영 화면(`ui/screens/Camera`) 한 곳뿐**이다.
 * 수명·자리·회전을 그 화면이 전부 쥐고 있다.
 */

import { CameraPreview } from '@capacitor-community/camera-preview'
import { toCaptured } from './image'
import type { FlashMode, PreviewPort } from './ports'

/** 웹에서는 이 id 를 가진 요소 안에 `<video>` 가 들어간다 */
export const PREVIEW_PARENT = 'ilboja-preview'

let running = false

/** 버튼이 도는 순서이기도 하다 — 끔 → 켬 → 손전등 → 끔 */
const OUR_MODES: FlashMode[] = ['off', 'on', 'torch']

/**
 * 켜기·끄기를 **한 줄로 세운다.**
 *
 * 겹쳐 부르면 플러그인이 `camera already started` 로 거절한다. 예전 코드는 `running` 을
 * **start 가 끝난 뒤에** 세워서, 아직 켜지는 중인 두 번째 호출이 "안 켜져 있다"고 보고
 * 그대로 또 켰다 — 개발 중 StrictMode 이중 마운트에서 매번 터졌고, 회전할 때도 같은 길이다.
 * 플래그 대신 순서를 보장한다.
 */
let chain: Promise<unknown> = Promise.resolve()
function queue<T>(op: () => Promise<T>): Promise<T> {
  // 앞 작업이 실패했어도 다음은 돌아야 한다(둘 다 같은 op 로 이어 붙인다)
  const next = chain.then(op, op)
  chain = next.catch(() => undefined)
  return next
}

/**
 * 무조건 끈다. **반쯤 켜진 것이 남아 있으면 다음 `start` 가 통째로 거절되므로** 예외는 삼킨다.
 *
 * 웹 구현에는 버그가 하나 있다 — `getUserMedia` 가 거절돼도 그 뒤 코드가 계속 돌아
 * `<video id="video">` 를 붙여 놓고, 그 상태의 `stop()` 은 `srcObject` 가 없어 터진다.
 * 그러면 그 엘리먼트가 영영 남아 **이후 모든 촬영이 「이미 시작됨」으로 막힌다**(PC 개발 중 재현).
 * 남은 것은 우리가 치운다.
 */
async function hardStop(): Promise<void> {
  running = false
  try {
    await CameraPreview.stop()
  } catch {
    /* 안 켜져 있으면 그만이다 */
  }
  document.getElementById('video')?.remove()
}

export const cameraPreview: PreviewPort = {
  start(rect) {
    return queue(async () => {
      // 켜기 전에 언제나 한 번 끈다 — 앞의 것이 남아 있는지 여기서는 알 수 없다
      await hardStop()
      await CameraPreview.start({
        position: 'rear',
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        /**
         * 프리뷰를 **뒤에** 그린다 — 우리 화면이 그 위에 온다.
         *
         * 2026-07-29 에 이 방식이 "실기기에서 하얗게만 나온다"고 판단해 `false` 로 뒤집었었는데,
         * **원인은 기기가 아니라 우리 CSS 였다.** 플러그인은 시작할 때
         * `webView.setBackgroundColor(Color.TRANSPARENT)` 를 직접 호출하고 WebView 를 앞으로
         * 가져온다(`CameraPreview.java` 350행). 그런데 우리 `body`(#f2f4f7)·`.phone`(흰색)이
         * 그 위에 불투명한 색을 다시 칠하고 있었다 — 투명해진 건 WebView 지 우리 배경이 아니다.
         * 그래서 촬영 화면에서는 배경을 통째로 비운다(`[data-cam='1']`, styles.css).
         *
         * 앞에 그리면(`toBack:false`) **표를 프리뷰 위에 얹을 수 없다** — 네이티브 뷰가 위라
         * 우리가 그리는 건 전부 그 아래 깔린다. 표 자리를 보면서 고르는 게 이 화면의 핵심이라
         * 뒤에 그리는 것 말고는 길이 없다.
         */
        toBack: true,
        parent: PREVIEW_PARENT,
        className: 'preview-video',
        disableAudio: true,
        /**
         * **가로/세로를 잠그지 않는다.** 폰을 돌리면 그대로 가로 촬영이 돼야 한다(사용자 요구, 2026-08-03).
         * 회전해도 안드로이드는 액티비티를 다시 만들지 않으므로(`configChanges` 에 orientation 이 있다)
         * 네이티브 프리뷰는 옛 자리·옛 방향에 그대로 남는다 — **화면 쪽이 회전을 보고 다시 켜야 한다**(Camera.tsx).
         */
        lockAndroidOrientation: false,
        /**
         * ❌ **핀치 줌은 안 켠다 — 셔터가 정확히 2배로 늦는다** (실기기 A/B, 2026-08-03).
         *
         * `true` 면 줌 자체는 **된다.** 프리뷰가 뒤에 있어도(`toBack:true`) 플러그인이 WebView
         * 터치를 네이티브 뷰로 중계하기 때문이다(`CameraPreview.java:489` `setupBroadcast`).
         *
         * 문제는 곁딸림이다. 이 옵션이 켜져야 플러그인이 터치 리스너를 달고, 그러면
         * **탭 → 초점**(`tapToFocus`, 플러그인이 늘 `true`)까지 같이 살아난다 →
         * **셔터를 누른 그 탭이 초점 잡기를 시켜** 촬영이 그만큼 밀린다. 같은 자리·같은 장면:
         *
         * | | 네이티브 촬영 |
         * |---|---|
         * | `false` | 0.66초 · 0.66초 |
         * | `true`  | 1.31초 · 1.31초 |
         *
         * 셔터는 4.8초에서 0.7초까지 끌어내린 주 동선이다. 어쩌다 쓰는 줌 때문에 장당 0.65초를
         * 도로 내주지 않는다(사용자 결정). 되살리려면 프리뷰가 켜진 뒤 그 fragment 의
         * `tapToFocus` 를 꺼야 한다 — `getFragmentManager().findFragmentById(20)` 의 public 필드다.
         */
        enableZoom: false,
      })
      running = true
    })
  },

  stop() {
    return queue(hardStop)
  },

  async flashModes() {
    if (!running) return []
    try {
      const { result } = await CameraPreview.getSupportedFlashModes()
      // 기기가 주는 목록에는 `auto`·`red-eye` 도 섞여 온다. 우리가 쓰는 것만 남긴다
      return OUR_MODES.filter((m) => result.includes(m))
    } catch {
      // 플래시가 없는 기기거나 PC 브라우저(웹 구현은 «지원 안 함» 을 던진다). 버튼을 안 보이게 한다
      return []
    }
  },

  setFlash(mode) {
    return CameraPreview.setFlashMode({ flashMode: mode })
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
