/**
 * File API 카메라. 폰에서는 `capture` 속성이 카메라 앱을 띄우고, PC 에서는 파일 선택창이 뜬다.
 *
 * EXIF 회전은 **직접 파싱하지 않는다.** `createImageBitmap` 의 `imageOrientation:'from-image'`
 * 가 처리한다 — 직접 돌리면 브라우저가 이미 돌린 것 위에 또 돌아간다(이중 회전).
 * 단계 5에서 Capacitor Camera 로 갈리지만 CameraPort 계약은 그대로다.
 */

import type { CameraPort, PhotoSource } from '../ports'

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

/** 저장해 둔 원본을 다시 그릴 수 있게 되돌린다 (부팅 복원) */
export function decode(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob, { imageOrientation: 'from-image' })
}

export const webCamera: CameraPort = {
  async capture(source) {
    const file = await pick(source)
    if (!file) return null
    const bitmap = await decode(file)
    return {
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap,
      blob: file,
      sha256: await sha256(file),
    }
  },
}
