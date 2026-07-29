/**
 * 브라우저용 DbPort — 메타도 사진 바이트도 IndexedDB 에 담는다.
 * 안드로이드는 메타만 여기를 같이 쓰고 바이트는 실제 파일로 간다 (`platform/native/db.ts`).
 */

import * as idb from '../idb'
import type { DbPort } from '../ports'

export const webDb: DbPort = {
  load: idb.loadMeta,
  saveMeta: idb.saveMeta,
  getBlob: idb.getBlob,
  async putBlobs(id, blobs) {
    await idb.putBlobs(id, blobs.original, blobs.thumb)
    return { original: '', thumb: '' } // 파일이 아니다. 자리 이름이 없다
  },
  async remove(id) {
    await idb.removeMeta(id)
    await idb.removeBlobs(id)
  },
}
