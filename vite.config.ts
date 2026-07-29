import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * `__BUILD__` — 홈 화면 아래에 찍히는 빌드 시각.
 * APK 를 폰에 넣고 "이게 새 빌드가 맞나"로 시간을 여러 번 버려서 넣었다 (2026-07-29).
 */
const built = new Date().toLocaleString('sv-SE').slice(5, 16) // MM-DD HH:mm

export default defineConfig({
  plugins: [react()],
  define: { __BUILD__: JSON.stringify(built) },
})
