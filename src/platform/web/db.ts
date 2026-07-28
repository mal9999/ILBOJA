/**
 * IndexedDB 어댑터 — 메타(`photos`)·원본(`blobs`)·썸네일(`thumbs`)을 나눠 담는다.
 *
 * 나눈 이유가 둘이다.
 * 1. 표 값 한 글자를 고쳐도 메타만 다시 쓰면 되고, 수 MB 원본은 건드리지 않는다(비파괴).
 * 2. **부팅할 때 메타만 읽는다.** 원본까지 읽어 펼치면 100장에 4.8GB — 화면을 그리기 전에 죽는다.
 *
 * 단계 4b에서 SQLite + Filesystem 으로 갈리지만 DbPort 계약은 그대로다.
 */

import type { Photo } from '../../core/models'
import type { BlobKind, DbPort } from '../ports'

const NAME = 'ilboja'
const VERSION = 2
const META = 'photos'
const STORE: Record<BlobKind, string> = { original: 'blobs', thumb: 'thumbs' }

let opening: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      // v1 에는 크기(width/height)도 썸네일도 없다. 되살려 봐야 그릴 수 없으니 비우고 시작한다
      for (const s of [...db.objectStoreNames]) db.deleteObjectStore(s)
      db.createObjectStore(META, { keyPath: 'id' })
      db.createObjectStore(STORE.original)
      db.createObjectStore(STORE.thumb)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return opening
}

/** 요청 사이에서 `await` 하면 트랜잭션이 먼저 닫힌다. 요청은 미리 걸고 결과는 완료 뒤에 읽는다 */
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
    const tx = db.transaction([META], 'readonly')
    const metas = tx.objectStore(META).getAll()
    await done(tx)
    const out = metas.result as Photo[]
    // 찍은 순서 = 화면 순서. id 는 촬영 시각으로 만들어져 동률을 갈라 준다
    return out.sort(
      (a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.id.localeCompare(b.id),
    )
  },

  async saveMeta(photo) {
    const db = await open()
    const tx = db.transaction([META], 'readwrite')
    tx.objectStore(META).put(photo)
    await done(tx)
  },

  async putBlobs(id, blobs) {
    const db = await open()
    const tx = db.transaction([STORE.original, STORE.thumb], 'readwrite')
    tx.objectStore(STORE.original).put(blobs.original, id)
    tx.objectStore(STORE.thumb).put(blobs.thumb, id)
    await done(tx)
  },

  async getBlob(id, kind) {
    const db = await open()
    const tx = db.transaction([STORE[kind]], 'readonly')
    const req = tx.objectStore(STORE[kind]).get(id)
    await done(tx)
    return (req.result as Blob | undefined) ?? null
  },

  async remove(id) {
    const db = await open()
    const tx = db.transaction([META, STORE.original, STORE.thumb], 'readwrite')
    tx.objectStore(META).delete(id)
    tx.objectStore(STORE.original).delete(id)
    tx.objectStore(STORE.thumb).delete(id)
    await done(tx)
  },
}
