/**
 * 플랫폼 포트 — `ui/` 는 여기로만 바깥과 이야기한다.
 * 구현은 `platform/web`(개발·PC)과 `platform/native`(Capacitor)로 갈린다.
 * 정본: 02.아키텍처.md §2 · 03.화면-표준스펙.md §5.3
 */

export type PhotoSource =
  | 'camera' // 앱 카메라
  | 'system' // 시스템 카메라 (동산 조리개 버튼 대응. 광각·줌)
  | 'gallery' // 폰 사진 가져오기

/** 촬영 결과. 원본은 불변이고, 화면에는 이 비트맵을 그린다 */
export interface CapturedImage {
  width: number
  height: number
  /** 캔버스에 바로 그릴 수 있는 것 */
  source: CanvasImageSource
}

export interface CameraPort {
  /** 사용자가 취소하면 null */
  capture(source: PhotoSource): Promise<CapturedImage | null>
}

/**
 * 세션 간에 살아남아야 하는 작은 값들.
 * 카메라가 뜬 사이 안드로이드가 앱을 죽여도 `slate`·`cur` 를 잃지 않기 위한 것(03 §2.3).
 */
export interface StoragePort {
  get<T>(key: string): T | null
  set<T>(key: string, value: T): void
}

export interface SharePort {
  /** 파일로 내보내기·공유. 지금은 안내만 하고 실제 전송은 단계 5 */
  share(label: string): Promise<void>
}

export interface Ports {
  camera: CameraPort
  storage: StoragePort
  share: SharePort
}
