/**
 * 브라우저(개발·PC)용 어댑터.
 * 카메라는 가짜다 — 캔버스로 현장 사진 비슷한 걸 그려 낸다.
 * 단계 3에서 File API 로 실제 사진 불러오기가 붙고, 단계 4~5에서 Capacitor 로 갈린다.
 */

import type {
  CameraPort,
  CapturedImage,
  PhotoSource,
  Ports,
  SharePort,
  StoragePort,
} from '../ports'

/** 가짜 사진 — 매번 조금씩 다르게 그려서 넘길 때 구분이 된다 */
function fakePhoto(seed: number, source: PhotoSource): CapturedImage {
  const W = source === 'gallery' ? 1600 : 1200
  const H = Math.round((W * 3) / 4)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!

  const hue = (seed * 47) % 360
  const grad = g.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, `hsl(${hue} 18% 88%)`)
  grad.addColorStop(0.55, `hsl(${hue} 12% 62%)`)
  grad.addColorStop(1, `hsl(${hue} 20% 22%)`)
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)

  g.fillStyle = 'rgba(0,0,0,.18)'
  g.fillRect(0, 0, W, H * 0.1)
  g.fillStyle = 'rgba(255,255,255,.10)'
  g.fillRect(0, H * 0.84, W, H * 0.16)

  // 하자 자국 비슷한 것
  g.strokeStyle = 'rgba(120,60,40,.5)'
  g.lineWidth = W * 0.012
  g.beginPath()
  g.moveTo(W * (0.2 + (seed % 5) * 0.12), H * 0.1)
  g.bezierCurveTo(W * 0.4, H * 0.35, W * 0.3, H * 0.5, W * 0.5, H * 0.7)
  g.stroke()

  // 몇 번째 사진인지 흐리게 — 스와이프가 도는지 눈으로 보려고
  g.fillStyle = 'rgba(255,255,255,.16)'
  g.font = `bold ${Math.round(H * 0.42)}px sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(String(seed), W / 2, H / 2)

  return { width: W, height: H, source: c }
}

let seq = 0

const camera: CameraPort = {
  async capture(source) {
    return fakePhoto(++seq, source)
  },
}

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

export const webPorts: Ports = { camera, storage, share }
