import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor 설정. `appId` 는 Play 업로드 후에는 바꿀 수 없다.
 * `webDir` = vite build 산출물 — `cap sync` 가 이걸 android 로 실어 나른다.
 */
const config: CapacitorConfig = {
  appId: 'kr.ilboja.app',
  appName: '일보자',
  webDir: 'dist',
}

export default config
