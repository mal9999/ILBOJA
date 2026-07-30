/**
 * PC 개발용 카메라 — 파일 선택창.
 *
 * ⚠️ 안드로이드에서는 이걸 쓰지 않는다. `capture` 속성이 있어도 WebView 가 카메라를 바로
 * 띄우지 않고 **선택 창을 먼저 띄워서**, 현장에서 한 장 찍을 때마다 고르기를 강요한다.
 * APK 는 `platform/native/camera.ts`(Capacitor Camera)를 쓴다.
 */

import { toCaptured } from '../image'
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

function pick(source: PhotoSource): Promise<File[]> {
  const el = fileInput()
  if (source === 'gallery') {
    el.removeAttribute('capture')
    el.multiple = true // 갤러리에서는 여러 장을 고를 수 있다
  } else {
    el.setAttribute('capture', 'environment')
    el.multiple = false
  }
  el.value = '' // 같은 파일을 다시 골라도 change 가 오도록

  return new Promise((resolve) => {
    const off = () => {
      el.removeEventListener('change', onChange)
      el.removeEventListener('cancel', onCancel)
    }
    const onChange = () => {
      off()
      resolve([...(el.files ?? [])])
    }
    const onCancel = () => {
      off()
      resolve([])
    }
    el.addEventListener('change', onChange)
    el.addEventListener('cancel', onCancel)
    el.click()
  })
}

export const webCamera: CameraPort = {
  async capture(source) {
    // 여기서 펼치지 않는다 — 화면이 한 장씩 열어 간다 (ports `PickedImage`)
    return (await pick(source)).map((file) => () => toCaptured(file))
  },
}
