/**
 * 플랫폼 포트 — `ui/` 는 여기로만 바깥과 이야기한다.
 * 구현은 `platform/web`(개발·PC)과 `platform/native`(Capacitor)로 갈린다.
 * 정본: 02.아키텍처.md §2 · 03.화면-표준스펙.md §5.3
 */

import type { Photo } from '../core/models'

/**
 * 화면에 그릴 긴 변 상한. 원본(4080×3060)을 그대로 펼치면 장당 50MB,
 * 여기까지 줄이면 11MB다. 원본 파일은 고화질 그대로 보관되고 내보내기는 거기서 다시 그린다 (02 §4).
 */
export const DISPLAY_EDGE = 1920

/** 목록 썸네일 긴 변. 100장 ≈ 30MB */
export const THUMB_EDGE = 320

/**
 * 예외 하나를 **사람이 읽을 한 줄**로.
 *
 * `e instanceof Error ? e.message : String(e)` 로는 안 된다 — Capacitor 플러그인은
 * `Error` 가 아니라 `{ message: 'camera already started' }` 같은 **평범한 객체**를 던지고,
 * 그러면 `String(e)` 가 `[object Object]` 를 뱉는다. 현장에서 원인을 못 찾게 되는 게
 * 정확히 이 지점이라(스낵바가 유일한 단서다) 메시지를 끝까지 캐낸다.
 */
export function reason(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e !== null && 'message' in e) return String(e.message)
  return String(e)
}

/** 촬영 결과. 원본은 불변이고, 화면에는 줄여서 펼친 비트맵을 그린다 */
export interface CapturedImage {
  /** 원본 픽셀 크기(EXIF 회전 적용 후). 화면용 비트맵 크기가 아니다 */
  width: number
  height: number
  /** 화면용으로 **줄여서** 펼친 것. 원본을 통째로 펼치지 않는다 */
  source: ImageBitmap
  /** 원본 바이트 그대로. 저장은 이걸 쓴다 — 다시 인코딩하지 않는다(비파괴) */
  blob: Blob
  /** 목록용 320px 썸네일. 목록이 원본에서 그리면 결국 전량을 펼치게 된다 */
  thumb: Blob
  /** 원본 무결성 확인용. 비보안 컨텍스트(http)에서는 빈 문자열 */
  sha256: string
}

/**
 * 아직 **안 펼친** 사진 한 장. 부르는 순간에야 메모리에 올라온다.
 *
 * 갤러리에서 여러 장을 고르면 통째로 펼쳐서 돌려주고 싶어지는데, 그러면 20장에 220MB다
 * (장당 화면용 비트맵 ≈ 11MB). 단계 4a 에서 막아 둔 것이 그대로 되살아난다 (02 §4).
 * 그래서 **꺼내 쓸 권리만** 넘기고, 화면 쪽이 한 장씩 열어 저장소로 보낸다.
 */
export type PickedImage = () => Promise<CapturedImage>

/**
 * **폰 사진 불러오기 전용.** 촬영은 여기가 아니라 앱 안 카메라(`PreviewPort`)가 한다.
 *
 * 폰 카메라 앱을 띄우는 길(`Camera.getPhoto`)이 여기 있었는데 지웠다 — 이 기종은
 * 촬영 결과가 앱으로 안 돌아와서 **앱에도 갤러리에도 안 남았다**(2026-07-30).
 * 부르는 데가 없는 채로 남겨 두면 언젠가 다시 켜진다.
 */
export interface CameraPort {
  /** 사용자가 취소하면 빈 배열. 여러 장일 수 있다 */
  pickFromGallery(): Promise<PickedImage[]>
}

/** 미리보기를 띄울 자리 (CSS 픽셀) */
export interface PreviewRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * **앱 안 카메라** — 폰 카메라 앱으로 나가지 않는다 (2026-07-29 전환).
 *
 * 나갔다 오는 방식은 두 가지가 깨졌다: 기종에 따라 촬영 후 결과가 안 돌아오고,
 * 카메라가 떠 있는 동안 안드로이드가 앱을 죽이면 찍은 게 통째로 사라진다(`03` §2.3).
 * 앱을 안 벗어나면 둘 다 생기지 않고, 표를 고치고 셔터를 누르는 반복이 장당 1터치가 된다.
 */
export interface PreviewPort {
  /** 프리뷰를 이 자리에 띄운다 */
  start(rect: PreviewRect): Promise<void>
  stop(): Promise<void>
  /**
   * 셔터. 취소·실패면 null.
   *
   * @param size 찍을 크기(설정 「카메라 해상도」). 안 주면 기기 기본.
   *   **이걸 안 넘기고 있었다** — 설정에서 해상도를 골라도 아무 일도 없었고, 늘 12MP 로 찍혔다.
   *   12MP 는 내보낼 때마다 통째로 다시 펼쳐야 해서 장당 수 초가 든다 (2026-07-30 실기기).
   */
  shoot(size?: { width: number; height: number }): Promise<CapturedImage | null>
}

export type BlobKind = 'original' | 'thumb'

export interface PhotoBlobs {
  original: Blob
  thumb: Blob
}

/** 저장된 자리. 파일이 아닌 곳(브라우저 IndexedDB)에 담기면 빈 문자열 */
export interface StoredPaths {
  original: string
  thumb: string
}

/**
 * 사진 메타와 원본의 영속 저장 (03 §5.3 `Db`).
 * 브라우저=IndexedDB, 안드로이드=SQLite + Filesystem (단계 4b). 계약은 같다.
 *
 * **바이트는 메타와 따로 오간다.** 부팅 때 전부 읽어 펼치면 100장에 4.8GB —
 * 화면을 그리기도 전에 죽는다(02 §4). 메타만 먼저 읽고, 바이트는 보여 줄 때 하나씩 꺼낸다.
 */
export interface DbPort {
  /** 앱 시작 시 **메타만** 전부. 휴지통 것(`deletedAt`)도 함께 온다 */
  load(): Promise<Photo[]>
  saveMeta(photo: Photo): Promise<void>
  /** 원본·썸네일은 사진이 들어올 때 한 번만 쓰고 그대로 둔다(비파괴). 반환 = `Photo` 에 적을 자리 */
  putBlobs(id: string, blobs: PhotoBlobs): Promise<StoredPaths>
  getBlob(id: string, kind: BlobKind): Promise<Blob | null>
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
  /**
   * 찍은 **원본을 폰 갤러리에 한 벌 남긴다** (2026-08-03 사용자 결정).
   *
   * 우리 원본은 앱 전용 영역에 있어서 **앱을 지우면 같이 사라진다** — 보고서 근거자료가 그렇게
   * 날아가면 안 된다. 갤러리에 있으면 앱에 무슨 일이 생겨도 **「불러오기」로 다시 작업할 수 있고**,
   * 구글포토 백업에도 자동으로 실린다.
   *
   * 앱 전용본을 없애고 갤러리 것만 쓰지는 않는다 — 사용자가 갤러리를 정리하다 지우면
   * 앱 안의 사진이 통째로 깨진다. 용량 두 벌은 그 값이다(2026-07-29 판단과 같다).
   *
   * @param fileName 갤러리에 남길 이름. 촬영 시각 기준 — 표 값은 나중에 바뀔 수 있어 못 쓴다
   * @returns 사용자에게 보여줄 저장 위치
   */
  saveOriginal(fileName: string, blob: Blob): Promise<string>
  /**
   * 표를 구운 사진 한 장을 저장한다. **경로 규칙은 `buildPath` 가 이미 정했고 여기서는 따르기만 한다.**
   *
   * @param relPath 저장 뿌리 기준 상대 경로 (`행복아파트/101동 1502호/누수보수_후_001.jpg`)
   * @returns 사용자에게 보여줄 실제 저장 위치. 어디에 저장됐는지 말해 줄 수 있어야 한다
   */
  writeExport(relPath: string, blob: Blob): Promise<string>
  /** 파일로 공유(카톡 등). 단계 5 */
  share(label: string): Promise<void>
}

export interface Ports {
  camera: CameraPort
  preview: PreviewPort
  storage: StoragePort
  db: DbPort
  share: SharePort
}
