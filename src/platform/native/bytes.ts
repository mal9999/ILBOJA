/**
 * Capacitor Filesystem 은 바이너리를 base64 문자열로 주고받는다.
 * `Blob` ↔ base64 변환은 native 어댑터 여러 곳에서 쓰므로 여기 모아 둔다.
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

export async function fromBase64(b64: string): Promise<Blob> {
  return (await fetch(`data:image/jpeg;base64,${b64}`)).blob()
}
