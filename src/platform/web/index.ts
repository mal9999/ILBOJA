/**
 * 브라우저(개발·PC)용 어댑터 모음.
 * 카메라는 File API, 사진 저장은 IndexedDB, 작은 값은 localStorage.
 * 단계 4~5에서 Capacitor(native)로 갈린다 — 바뀌는 건 이 폴더뿐이다.
 */

import type { Ports, SharePort, StoragePort } from '../ports'
import { webCamera } from './camera'
import { webDb } from './db'

const PREFIX = 'ilboja:'

const storage: StoragePort = {
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

const share: SharePort = {
  async share() {
    /* 단계 5에서 @capacitor/share. 지금은 화면에서 안내 스낵바만 띄운다 */
  },
}

export const webPorts: Ports = { camera: webCamera, storage, db: webDb, share }
