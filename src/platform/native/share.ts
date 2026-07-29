/**
 * 안드로이드 내보내기 — 표를 구운 사진을 **사용자가 볼 수 있는 폴더**에 쓴다.
 * 여기가 폴더 자동정리(`00` §8 "알아서 정리되어 찾기 편하다")가 실현되는 유일한 지점이다.
 *
 * ⚠️ 안드로이드 11+(targetSdk 36)는 스코프드 스토리지라 공용 `/Documents` 직접 쓰기가 막힐 수 있다.
 * `@capacitor/filesystem` 은 MediaStore·SAF 를 쓰지 않고 `java.io.File` 로만 접근하므로
 * **실기기에서 확인해야 안다(단계 6).** 막히면 앱 전용 외부 폴더로 떨어뜨리고,
 * 어디에 저장됐는지 화면에 그대로 말해 준다 — 조용히 다른 데 저장하는 게 최악이다.
 */

import { Directory, Filesystem } from '@capacitor/filesystem'
import type { SharePort } from '../ports'
import { toBase64 } from './bytes'

/** 저장 뿌리 아래 앱 폴더. 남의 파일과 섞이지 않게 한 겹 둔다 */
const APP_FOLDER = '일보자'

const TARGETS = [
  { dir: Directory.Documents, label: '문서 폴더 › 일보자' },
  { dir: Directory.External, label: '앱 전용 폴더 (문서 폴더 쓰기가 막혀 여기 저장됨)' },
] as const

/** 한 번 성공한 자리를 기억한다. 100장을 매번 두 번씩 시도할 이유가 없다 */
let chosen: (typeof TARGETS)[number] | null = null

export const nativeShare: SharePort = {
  async writeExport(relPath, blob) {
    const data = await toBase64(blob)
    const path = `${APP_FOLDER}/${relPath}`
    let lastError: unknown

    for (const target of chosen ? [chosen] : TARGETS) {
      try {
        await Filesystem.writeFile({ path, data, directory: target.dir, recursive: true })
        chosen = target
        return target.label
      } catch (e) {
        lastError = e
      }
    }
    throw lastError
  },

  async share() {
    /* 단계 5에서 @capacitor/share — 카톡 "파일로 전송" */
  },
}
