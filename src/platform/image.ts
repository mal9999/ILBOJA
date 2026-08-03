/**
 * 사진 한 장을 앱이 쓸 형태로 만든다 — 브라우저·안드로이드 공용.
 * 파일 선택창에서 왔든 카메라 앱에서 왔든, 바이트가 손에 들어온 뒤부터는 처리가 같다.
 */

import type { Rotate } from '../core/models'
import { DISPLAY_EDGE, THUMB_EDGE, type CapturedImage } from './ports'

/**
 * 사진을 캔버스에 **회전을 적용해** 그리고, 캔버스를 그 크기로 맞춘다.
 *
 * ⚠️ **표는 반드시 이걸 부른 «뒤에» 그려야 한다.** 여기서 좌표계를 되돌려 놓으므로
 * 이후에 그리는 것은 회전과 무관하게 똑바로 선다 — 표가 사진과 같이 눕지 않는 이유다.
 *
 * @returns 회전이 적용된 캔버스 크기
 */
export function drawPhoto(
  cv: HTMLCanvasElement,
  c: CanvasRenderingContext2D,
  img: ImageBitmap,
  rotate: Rotate = 0,
): { width: number; height: number } {
  const turned = rotate === 90 || rotate === 270
  cv.width = turned ? img.height : img.width
  cv.height = turned ? img.width : img.height

  c.save()
  // 캔버스 한가운데를 축으로 돌린 뒤, 그림을 그 축 기준으로 가운데 놓는다
  c.translate(cv.width / 2, cv.height / 2)
  c.rotate((rotate * Math.PI) / 180)
  c.drawImage(img, -img.width / 2, -img.height / 2)
  c.restore()

  return { width: cv.width, height: cv.height }
}

/** 원본 무결성 확인용(03 §5.3). http 로 열면 `crypto.subtle` 이 없다 — 그때는 빈 값 */
async function sha256(blob: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) return ''
  const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 목록용 320px. 화면용 비트맵에서 줄여 만든다 — 원본을 또 펼치지 않는다.
 *
 * 먼저 `createImageBitmap` 으로 320px 까지 줄인 뒤 캔버스에 그린다(축소는 0ms 로 측정됐다).
 * 캔버스가 읽어야 할 픽셀을 처음부터 작게 두는 쪽이 안전하다.
 */
async function makeThumb(src: ImageBitmap): Promise<Blob> {
  const k = Math.min(1, THUMB_EDGE / Math.max(src.width, src.height))
  const w = Math.max(1, Math.round(src.width * k))
  const h = Math.max(1, Math.round(src.height * k))

  const small = await createImageBitmap(src, {
    resizeWidth: w,
    resizeHeight: h,
    // 320px 썸네일이다. high 로 올릴 이유가 없다
    resizeQuality: 'medium',
  })
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d', { willReadFrequently: true })!.drawImage(small, 0, 0)
  small.close()

  /**
   * ⚠️ **`toBlob` 을 쓰면 안 된다 — 콜백이 4초 밀린다.**
   *
   * `toBlob`·`OffscreenCanvas.convertToBlob` 의 콜백은 크로미움의 렌더링 파이프라인에 묶여
   * 스케줄된다. 셔터를 누르면 네이티브가 `takePicture` 로 프리뷰를 멈추고 그동안 **WebView 가
   * 프레임을 안 그리므로**, 프리뷰가 재시작될 때까지 콜백이 통째로 대기한다.
   * 실기기에서 **아무것도 안 그린 8×8 캔버스조차 4.0초**였다 (2026-08-03).
   * 그림 크기·`willReadFrequently`·OffscreenCanvas 를 아무리 바꿔도 값이 4.0 으로 똑같았던 이유다.
   *
   * `toDataURL` 은 **동기 함수**라 스케줄될 콜백이 없다. 320px 썸네일이라 문자열도 20KB 남짓이다.
   */
  const url = c.toDataURL('image/jpeg', 0.8)
  return await (await fetch(url)).blob()
}

/**
 * EXIF 회전은 **직접 파싱하지 않는다.** `imageOrientation:'from-image'` 가 처리한다 —
 * 직접 돌리면 브라우저가 이미 돌린 것 위에 또 돌아간다(이중 회전).
 */
export async function toCaptured(blob: Blob): Promise<CapturedImage> {
  // 크기를 알아야 줄일 비율이 나오므로 한 번은 펼쳐야 한다. 대신 **들고 있지 않는다** —
  // 화면용으로 줄인 것만 남기고 즉시 close(). 위험한 건 순간 최대치가 아니라 계속 쥐고 있는 쪽이다.
  const full = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  const width = full.width
  const height = full.height

  const k = Math.min(1, DISPLAY_EDGE / Math.max(width, height))
  const display =
    k < 1
      ? await createImageBitmap(full, {
          resizeWidth: Math.round(width * k),
          resizeQuality: 'high',
        })
      : full
  if (display !== full) full.close()

  return {
    width,
    height,
    source: display,
    blob,
    thumb: await makeThumb(display),
    sha256: await sha256(blob),
  }
}
