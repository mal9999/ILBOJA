/**
 * EXIF Orientation — 테스트 픽스처.
 * 이관: 04.mock/기술검증-스파이크.html `exifApp1` · `injectExif`
 *
 * ⚠️ **회전을 직접 처리하는 코드는 없다. 있어서도 안 된다.**
 *
 * 02.아키텍처 이관표는 `readExifOrientation` 함수를 이관하라고 적었지만
 * 스파이크에 그런 함수는 존재하지 않는다(2026-07-28 확인). 실제 검증 결과는
 * **브라우저가 알아서 한다**는 것이었다 —
 *
 *     createImageBitmap(blob, { imageOrientation: 'from-image' })
 *
 * 이 한 줄이 8방향을 전부 올바르게 돌려준다(8/8 통과). 우리가 EXIF를 파싱해서
 * 직접 회전시키면 이중 회전이 나거나 브라우저 최적화를 잃는다.
 *
 * 그래서 이 파일은 **그 전제가 계속 성립하는지 확인하는 픽스처**만 담는다.
 * 회전 로직은 없다.
 */

/** 브라우저 디코드 시 항상 이 옵션을 쓴다. EXIF 회전이 자동 적용된다 */
export const DECODE_OPTIONS: ImageBitmapOptions = { imageOrientation: 'from-image' }

/**
 * Orientation 값 하나를 담은 최소 APP1(EXIF) 세그먼트를 만든다.
 * 리틀엔디언 TIFF 헤더 + IFD 엔트리 1개(0x0112 = Orientation).
 */
export function exifApp1(orientation: number): Uint8Array {
  const p = new Uint8Array(32)
  const v = new DataView(p.buffer)

  p.set([0x45, 0x78, 0x69, 0x66, 0, 0], 0) // "Exif\0\0"
  p.set([0x49, 0x49], 6) // "II" = 리틀엔디언
  v.setUint16(8, 42, true) // TIFF 매직
  v.setUint32(10, 8, true) // 첫 IFD 오프셋
  v.setUint16(14, 1, true) // IFD 엔트리 수 = 1
  v.setUint16(16, 0x0112, true) // 태그 = Orientation
  v.setUint16(18, 3, true) // 타입 = SHORT
  v.setUint32(20, 1, true) // 개수 = 1
  v.setUint16(24, orientation, true) // 값
  v.setUint32(28, 0, true) // 다음 IFD 없음

  const out = new Uint8Array(4 + p.length)
  const o = new DataView(out.buffer)
  o.setUint16(0, 0xffe1) // APP1 마커
  o.setUint16(2, p.length + 2) // 세그먼트 길이
  out.set(p, 4)
  return out
}

/** JPEG 바이트열의 SOI 바로 뒤에 APP1을 끼워 넣는다 */
export function injectExif(jpeg: Uint8Array, orientation: number): Uint8Array {
  const app1 = exifApp1(orientation)
  const r = new Uint8Array(jpeg.length + app1.length)
  r.set(jpeg.subarray(0, 2), 0) // SOI (FFD8)
  r.set(app1, 2)
  r.set(jpeg.subarray(2), 2 + app1.length)
  return r
}

/** orientation → 디코드 후 기대되는 (가로세로 뒤바뀜 여부, 원래 좌상단 마커가 가는 자리) */
export const ORIENTATION_EXPECT: Record<number, { swapped: boolean; marker: string }> = {
  1: { swapped: false, marker: '좌상' },
  2: { swapped: false, marker: '우상' },
  3: { swapped: false, marker: '우하' },
  4: { swapped: false, marker: '좌하' },
  5: { swapped: true, marker: '좌상' },
  6: { swapped: true, marker: '우상' },
  7: { swapped: true, marker: '우하' },
  8: { swapped: true, marker: '좌하' },
}
