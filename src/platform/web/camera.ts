/**
 * PC 개발용 사진 불러오기 — 파일 선택창.
 * APK 는 `platform/native/camera.ts`(Capacitor Camera)를 쓴다.
 */

import { toCaptured } from '../image'
import type { CameraPort } from '../ports'

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

function pick(): Promise<File[]> {
  const el = fileInput()
  el.multiple = true // 갤러리에서는 여러 장을 고를 수 있다
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
  async pickFromGallery() {
    // 여기서 펼치지 않는다 — 화면이 한 장씩 열어 간다 (ports `PickedImage`)
    return (await pick()).map((file) => () => toCaptured(file))
  },
}
