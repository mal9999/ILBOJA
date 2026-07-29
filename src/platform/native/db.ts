/**
 * 안드로이드용 DbPort — **메타는 IndexedDB, 사진 바이트는 실제 파일.**
 *
 * 바이트를 파일로 빼는 이유(02 §3): WebView 저장소에는 origin 할당량이 있어 하루 100장이
 * 쌓이면 저장이 실패하고, 파일 단위로 관리·백업할 수도 없다.
 * 자리는 **앱 전용 영역**(`Directory.Data`)이다 — 다른 앱이 못 건드리므로 원본이 불변으로 남는다.
 * 사용자에게 보이는 산출물은 원본이 아니라 내보내기 결과다(`native/share.ts`).
 */

import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import * as idb from '../idb'
import type { BlobKind, DbPort } from '../ports'
import { toBase64 } from './bytes'

const DIR = Directory.Data
const ROOT = 'photos'

const pathOf = (id: string, kind: BlobKind) =>
  `${ROOT}/${id}.${kind === 'thumb' ? 'thumb' : 'orig'}.jpg`

export const nativeDb: DbPort = {
  load: idb.loadMeta,
  saveMeta: idb.saveMeta,

  async putBlobs(id, blobs) {
    const original = pathOf(id, 'original')
    const thumb = pathOf(id, 'thumb')
    // recursive: photos 폴더가 없으면 만든다
    await Filesystem.writeFile({
      path: original,
      data: await toBase64(blobs.original),
      directory: DIR,
      recursive: true,
    })
    await Filesystem.writeFile({
      path: thumb,
      data: await toBase64(blobs.thumb),
      directory: DIR,
      recursive: true,
    })
    return { original, thumb }
  },

  /**
   * **base64 를 거치지 않는다.** `readFile` 은 사진 전체를 문자열로 바꿔 웹↔네이티브 다리를
   * 건너므로 원본(4000×3000)이면 6MB 짜리 문자열이 된다 — 내보내기가 한 장에도 느렸던 이유다
   * (2026-07-29 실기기). 파일 URL 로 바로 읽으면 다리를 안 건넌다.
   */
  async getBlob(id, kind) {
    try {
      const { uri } = await Filesystem.getUri({ path: pathOf(id, kind), directory: DIR })
      const res = await fetch(Capacitor.convertFileSrc(uri))
      if (!res.ok) return null
      return await res.blob()
    } catch {
      return null // 파일이 없으면 그릴 게 없다. 화면은 이 null 을 감당한다
    }
  },

  async remove(id) {
    await idb.removeMeta(id)
    for (const kind of ['original', 'thumb'] as const) {
      try {
        await Filesystem.deleteFile({ path: pathOf(id, kind), directory: DIR })
      } catch {
        /* 이미 없으면 그만이다 */
      }
    }
  },
}
