/**
 * Capacitor Filesystem 은 **쓸 때** 바이너리를 base64 문자열로 받는다.
 *
 * 읽을 때는 쓰지 않는다 — `Capacitor.convertFileSrc` + `fetch` 로 파일 URL 을 바로 읽으면
 * 웹↔네이티브 다리를 안 건넌다(`native/db.ts` 참고). 읽기까지 base64 로 하면
 * 원본 한 장이 6MB 짜리 문자열이 되어 내보내기가 눈에 띄게 느려진다.
 */

export function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    // readAsDataURL 은 "data:<mime>;base64,<본문>" 을 준다. 앞머리를 떼면 base64
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
