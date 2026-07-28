/**
 * 펼친 사진 캐시 (02 §4) — **동시에 몇 장을 펼쳐 두느냐**를 여기서 막는다.
 *
 * 메모리 = 장당 크기 × 동시에 펼친 장수. 앞항은 줄여서 디코드(`DISPLAY_EDGE`)로 11MB에 고정하고,
 * 뒷항은 여기 상한으로 막는다. 상한을 넘으면 오래된 것부터 `close()` —
 * GC 를 기다리면 그 사이에 죽으므로 즉시 해제해야 한다.
 */

import { useEffect, useState } from 'react'
import type { Photo } from '../../core/models'
import { DISPLAY_EDGE, type BlobKind } from '../../platform/ports'
import { usePorts } from './ports'

/** 화면용 11MB × 8 = 88MB, 썸네일 0.3MB × 120 = 36MB. 저가폰 몫(≈256MB) 안에 들어온다 */
const CAP: Record<BlobKind, number> = { original: 8, thumb: 120 }

const cache: Record<BlobKind, Map<string, ImageBitmap>> = {
  original: new Map(),
  thumb: new Map(),
}

/** 꺼내면서 "최근 쓴 것"으로 옮긴다 — Map 은 넣은 순서를 유지하므로 맨 앞이 가장 오래된 것 */
function take(kind: BlobKind, id: string): ImageBitmap | null {
  const c = cache[kind]
  const hit = c.get(id)
  if (!hit) return null
  c.delete(id)
  c.set(id, hit)
  return hit
}

function put(kind: BlobKind, id: string, bitmap: ImageBitmap) {
  const c = cache[kind]
  c.get(id)?.close()
  c.set(id, bitmap)
  while (c.size > CAP[kind]) {
    const oldest = c.keys().next().value as string
    c.get(oldest)?.close()
    c.delete(oldest)
  }
}

/** 방금 촬영해서 이미 펼쳐 둔 것을 넣어 둔다 — 곧바로 다시 읽어 펼치는 낭비를 막는다 */
export function primeImage(id: string, kind: BlobKind, bitmap: ImageBitmap) {
  put(kind, id, bitmap)
}

function decodeOptions(photo: Photo, kind: BlobKind): ImageBitmapOptions {
  const base: ImageBitmapOptions = { imageOrientation: 'from-image' }
  if (kind === 'thumb') return base // 썸네일 파일이 이미 320px 다
  const long = Math.max(photo.width, photo.height)
  if (long <= DISPLAY_EDGE) return base
  // 폭 하나만 준다 — 비율은 브라우저가 맞춘다
  return { ...base, resizeWidth: Math.round((photo.width * DISPLAY_EDGE) / long), resizeQuality: 'high' }
}

/**
 * 사진 한 장의 그릴 수 있는 형태. 아직 없으면 `null` 을 돌려주고 준비되면 다시 그린다.
 * 화면은 "불러오는 중"을 그릴 수 있어야 한다 — 언제나 있다고 가정하면 안 된다.
 */
export function usePhotoImage(photo: Photo | undefined, kind: BlobKind): ImageBitmap | null {
  const ports = usePorts()
  const [, redraw] = useState(0)

  useEffect(() => {
    if (!photo || take(kind, photo.id)) return
    let alive = true
    const load = async () => {
      const blob = await ports.db.getBlob(photo.id, kind)
      if (!blob || !alive) return
      const bitmap = await createImageBitmap(blob, decodeOptions(photo, kind))
      if (!alive) return bitmap.close()
      put(kind, photo.id, bitmap)
      redraw((n) => n + 1)
    }
    void load()
    return () => {
      alive = false
    }
  }, [ports, photo, kind])

  return photo ? take(kind, photo.id) : null
}
