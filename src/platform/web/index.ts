/**
 * 브라우저(개발·PC)용 어댑터 모음.
 * 카메라는 File API, 사진 저장은 IndexedDB, 작은 값은 localStorage.
 * 안드로이드는 `platform/native` 가 이 중 몇 개만 갈아 끼운다.
 */

import type { Ports, SharePort, StoragePort } from '../ports'
import { cameraPreview } from '../preview'
import { webCamera } from './camera'
import { webDb } from './db'

const PREFIX = 'ilboja:'

export const webStorage: StoragePort = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      return raw === null ? null : (JSON.parse(raw) as T)
    } catch {
      return null // 사파리 프라이빗 모드 등에서 던진다. 없는 셈 친다
    }
  },
  set<T>(key: string, value: T) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      /* 저장 못 해도 앱은 굴러가야 한다 */
    }
  },
}

export const webShare: SharePort = {
  /** PC 에는 앱 저장폴더가 없다. 브라우저가 할 수 있는 건 다운로드다 */
  async writeExport(relPath, blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // 폴더 구조는 못 만든다. 경로를 파일명에 녹여 어디로 갈지는 보이게 한다
    a.download = relPath.split('/').filter(Boolean).join('_')
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
    // 곧바로 지우면 다운로드가 끊긴다
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return '브라우저 다운로드 폴더'
  },
  /** PC 에는 갤러리가 없다. 원본은 이미 IndexedDB 에 있으니 할 일이 없다 */
  async saveOriginal() {
    return '(브라우저에는 갤러리가 없습니다)'
  },
  async share() {
    /* 단계 5에서 @capacitor/share */
  },
}

export const webPorts: Ports = {
  camera: webCamera,
  // 웹 구현은 getUserMedia 로 돈다 — PC 카메라로도 같은 동선을 확인할 수 있다
  preview: cameraPreview,
  storage: webStorage,
  db: webDb,
  share: webShare,
}
