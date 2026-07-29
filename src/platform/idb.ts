/**
 * IndexedDB 조각들 — 브라우저와 안드로이드가 **메타는 함께** 쓴다.
 *
 * 메타(`photos`)는 양쪽 다 여기에 담는다(02 §3 — SQLite 는 필요해지면 교체).
 * 사진 바이트(`blobs`·`thumbs`)는 브라우저만 여기에 담고, 안드로이드는 실제 파일로 간다.
 */

import type { Photo } from '../core/models'
import type { BlobKind } from './ports'

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

export async function loadMeta(): Promise<Photo[]> {
  const db = await open()
  const tx = db.transaction([META], 'readonly')
  const metas = tx.objectStore(META).getAll()
  await done(tx)
  // 찍은 순서 = 화면 순서. id 는 촬영 시각으로 만들어져 동률을 갈라 준다
  return (metas.result as Photo[]).sort(
    (a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.id.localeCompare(b.id),
  )
}

export async function saveMeta(photo: Photo): Promise<void> {
  const db = await open()
  const tx = db.transaction([META], 'readwrite')
  tx.objectStore(META).put(photo)
  await done(tx)
}

export async function removeMeta(id: string): Promise<void> {
  const db = await open()
  const tx = db.transaction([META], 'readwrite')
  tx.objectStore(META).delete(id)
  await done(tx)
}

export async function putBlobs(id: string, original: Blob, thumb: Blob): Promise<void> {
  const db = await open()
  const tx = db.transaction([STORE.original, STORE.thumb], 'readwrite')
  tx.objectStore(STORE.original).put(original, id)
  tx.objectStore(STORE.thumb).put(thumb, id)
  await done(tx)
}

export async function getBlob(id: string, kind: BlobKind): Promise<Blob | null> {
  const db = await open()
  const tx = db.transaction([STORE[kind]], 'readonly')
  const req = tx.objectStore(STORE[kind]).get(id)
  await done(tx)
  return (req.result as Blob | undefined) ?? null
}

export async function removeBlobs(id: string): Promise<void> {
  const db = await open()
  const tx = db.transaction([STORE.original, STORE.thumb], 'readwrite')
  tx.objectStore(STORE.original).delete(id)
  tx.objectStore(STORE.thumb).delete(id)
  await done(tx)
}
