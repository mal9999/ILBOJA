/**
 * 사진 한 장을 앱이 쓸 형태로 만든다 — 브라우저·안드로이드 공용.
 * 파일 선택창에서 왔든 카메라 앱에서 왔든, 바이트가 손에 들어온 뒤부터는 처리가 같다.
 */

import { DISPLAY_EDGE, THUMB_EDGE, type CapturedImage } from './ports'

/** 원본 무결성 확인용(03 §5.3). http 로 열면 `crypto.subtle` 이 없다 — 그때는 빈 값 */
async function sha256(blob: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) return ''
  const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 목록용 320px. 화면용 비트맵에서 줄여 만든다 — 원본을 또 펼치지 않는다 */
function makeThumb(src: ImageBitmap): Promise<Blob> {
  const k = Math.min(1, THUMB_EDGE / Math.max(src.width, src.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(src.width * k))
  c.height = Math.max(1, Math.round(src.height * k))
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height)
  return new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('썸네일 생성 실패'))), 'image/jpeg', 0.8)
  })
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
