/**
 * 안드로이드용 DbPort — **메타는 IndexedDB, 사진 바이트는 실제 파일.**
 *
 * 바이트를 파일로 빼는 이유(02 §3): WebView 저장소에는 origin 할당량이 있어 하루 100장이
 * 쌓이면 저장이 실패하고, 파일 단위로 관리·백업할 수도 없다.
 * 자리는 **앱 전용 영역**(`Directory.Data`)이다 — 다른 앱이 못 건드리므로 원본이 불변으로 남는다.
 * 사용자에게 보이는 산출물은 원본이 아니라 내보내기 결과다(`native/share.ts`).
 */

import { Directory, Filesystem } from '@capacitor/filesystem'
import * as idb from '../idb'
import type { BlobKind, DbPort } from '../ports'
import { fromBase64, toBase64 } from './bytes'

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

  async getBlob(id, kind) {
    try {
      const res = await Filesystem.readFile({ path: pathOf(id, kind), directory: DIR })
      // 네이티브는 base64 문자열, 웹 구현은 Blob 을 준다
      return typeof res.data === 'string' ? await fromBase64(res.data) : res.data
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
