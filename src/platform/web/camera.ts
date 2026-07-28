/**
 * File API 카메라. 폰에서는 `capture` 속성이 카메라 앱을 띄우고, PC 에서는 파일 선택창이 뜬다.
 *
 * EXIF 회전은 **직접 파싱하지 않는다.** `createImageBitmap` 의 `imageOrientation:'from-image'`
 * 가 처리한다 — 직접 돌리면 브라우저가 이미 돌린 것 위에 또 돌아간다(이중 회전).
 * 단계 5에서 Capacitor Camera 로 갈리지만 CameraPort 계약은 그대로다.
 */

import { DISPLAY_EDGE, THUMB_EDGE, type CameraPort, type PhotoSource } from '../ports'

/** 하나 만들어 두고 재사용한다. 매번 만들면 취소(cancel) 이벤트를 놓친다 */
let input: HTMLInputElement | null = null

function fileInput(): HTMLInputElement {
  if (input) return input
  const el = document.createElement('input')
  el.type = 'file'
  el.accept = 'image/*'
  el.id = 'ilboja-file'
  el.style.display = 'none'
  document.body.appendChild(el)
  input = el
  return el
}

function pick(source: PhotoSource): Promise<File | null> {
  const el = fileInput()
  // 갤러리는 폰 사진첩, 나머지는 카메라 앱
  if (source === 'gallery') el.removeAttribute('capture')
  else el.setAttribute('capture', 'environment')
  el.value = '' // 같은 파일을 다시 골라도 change 가 오도록

  return new Promise((resolve) => {
    const off = () => {
      el.removeEventListener('change', onChange)
      el.removeEventListener('cancel', onCancel)
    }
    const onChange = () => {
      off()
      resolve(el.files?.[0] ?? null)
    }
    const onCancel = () => {
      off()
      resolve(null)
    }
    el.addEventListener('change', onChange)
    el.addEventListener('cancel', onCancel)
    el.click()
  })
}

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
    c.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('썸네일 생성 실패'))),
      'image/jpeg',
      0.8,
    )
  })
}

export const webCamera: CameraPort = {
  async capture(source) {
    const file = await pick(source)
    if (!file) return null

    // 크기를 알아야 줄일 비율이 나오므로 한 번은 펼쳐야 한다. 대신 **들고 있지 않는다** —
    // 화면용으로 줄인 것만 남기고 즉시 close(). 위험한 건 순간 최대치가 아니라 계속 쥐고 있는 쪽이다.
    const full = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const width = full.width
    const height = full.height

    const k = Math.min(1, DISPLAY_EDGE / Math.max(width, height))
    const source_ =
      k < 1
        ? await createImageBitmap(full, {
            resizeWidth: Math.round(width * k),
            resizeQuality: 'high',
          })
        : full
    if (source_ !== full) full.close()

    return {
      width,
      height,
      source: source_,
      blob: file,
      thumb: await makeThumb(source_),
      sha256: await sha256(file),
    }
  },
}
