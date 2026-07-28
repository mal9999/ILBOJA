/**
 * 플랫폼 포트 — `ui/` 는 여기로만 바깥과 이야기한다.
 * 구현은 `platform/web`(개발·PC)과 `platform/native`(Capacitor)로 갈린다.
 * 정본: 02.아키텍처.md §2 · 03.화면-표준스펙.md §5.3
 */

import type { Photo } from '../core/models'

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
  /** 원본 바이트 그대로. 저장은 이걸 쓴다 — 다시 인코딩하지 않는다(비파괴) */
  blob: Blob
  /** 원본 무결성 확인용. 비보안 컨텍스트(http)에서는 빈 문자열 */
  sha256: string
}

export interface CameraPort {
  /** 사용자가 취소하면 null */
  capture(source: PhotoSource): Promise<CapturedImage | null>
}

/** 저장소에서 되살린 사진 한 장 — 메타 + 원본 + 그릴 수 있게 디코드된 것 */
export interface StoredPhoto {
  photo: Photo
  blob: Blob
  image: CanvasImageSource
  width: number
  height: number
}

/**
 * 사진 메타와 원본의 영속 저장 (03 §5.3 `Db`).
 * 브라우저=IndexedDB, 안드로이드=SQLite + Filesystem (단계 4). 계약은 같다.
 */
export interface DbPort {
  /** 앱 시작 시 전부. 휴지통 것(`deletedAt`)도 함께 온다 */
  load(): Promise<StoredPhoto[]>
  /** 메타 저장(덮어쓰기). `blob` 은 처음 한 번만 넘긴다 — 원본은 다시 쓰지 않는다 */
  save(photo: Photo, blob?: Blob): Promise<void>
  remove(id: string): Promise<void>
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
  db: DbPort
  share: SharePort
}
