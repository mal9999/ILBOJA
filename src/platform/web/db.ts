/**
 * IndexedDB 어댑터 — 메타(`photos`)와 원본(`blobs`)을 나눠 담는다.
 *
 * 나눈 이유: 표 값 한 글자를 고쳐도 메타만 다시 쓰면 되고, 수 MB 짜리 원본은 건드리지 않는다.
 * 원본은 사진이 들어올 때 한 번 쓰고 그대로 둔다(비파괴 — 02 §3).
 * 단계 4에서 SQLite + Filesystem 으로 갈리지만 DbPort 계약은 그대로다.
 */

import type { Photo } from '../../core/models'
import type { DbPort, StoredPhoto } from '../ports'
import { decode } from './camera'

const NAME = 'ilboja'
const VERSION = 1
const META = 'photos'
const BLOBS = 'blobs'

let opening: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return opening
}

/**
 * 트랜잭션이 끝날 때까지 기다린다.
 * 요청 사이에서 `await` 하면 트랜잭션이 먼저 닫혀 버리므로, 요청은 전부 미리 걸어 두고
 * 결과는 완료 뒤에 `.result` 로 읽는다.
 */
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export const webDb: DbPort = {
  async load() {
    const db = await open()
    const tx = db.transaction([META, BLOBS], 'readonly')
    const metas = tx.objectStore(META).getAll()
    const blobs = tx.objectStore(BLOBS).getAll()
    const keys = tx.objectStore(BLOBS).getAllKeys()
    await done(tx)

    const byId = new Map<string, Blob>()
    ;(keys.result as IDBValidKey[]).forEach((k, i) => {
      byId.set(String(k), (blobs.result as Blob[])[i])
    })

    const out: StoredPhoto[] = []
    for (const photo of metas.result as Photo[]) {
      const blob = byId.get(photo.id)
      if (!blob) continue // 원본이 없으면 그릴 수 없다. 메타만 남은 건 버린다
      const image = await decode(blob)
      out.push({ photo, blob, image, width: image.width, height: image.height })
    }
    // 찍은 순서 = 화면 순서. id 는 촬영 시각으로 만들어져 동률을 갈라 준다
    out.sort(
      (a, b) =>
        a.photo.capturedAt.localeCompare(b.photo.capturedAt) ||
        a.photo.id.localeCompare(b.photo.id),
    )
    return out
  },

  async save(photo, blob) {
    const db = await open()
    const tx = db.transaction(blob ? [META, BLOBS] : [META], 'readwrite')
    tx.objectStore(META).put(photo)
    if (blob) tx.objectStore(BLOBS).put(blob, photo.id)
    await done(tx)
  },

  async remove(id) {
    const db = await open()
    const tx = db.transaction([META, BLOBS], 'readwrite')
    tx.objectStore(META).delete(id)
    tx.objectStore(BLOBS).delete(id)
    await done(tx)
  },
}
