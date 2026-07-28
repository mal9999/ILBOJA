/**
 * 입력 검증 — 순수 함수. 플랫폼 의존 없음.
 * 정본: 03.화면-표준스펙.md §2.2 (미입력 빨강) · S2 목록 ⚠배지 · S3 내보내기 경고
 */

import type { Fields, FormRow } from './models'

/**
 * 필수인데 비어 있는 항목의 라벨 목록.
 *
 * 한 장씩 처리하는 흐름의 최대 위험은 "빠뜨림"이다(00.요구사항 §6.2).
 * 표·목록·내보내기 세 곳에서 같은 함수를 써서 판정이 갈리지 않게 한다.
 */
export function missingRequired(form: FormRow[], fields: Fields): string[] {
  return form
    .filter((r) => r.on && r.req)
    .filter((r) => (fields[r.key] ?? '').trim() === '')
    .map((r) => r.label)
}

/** 필수 항목이 전부 채워졌나 */
export function isComplete(form: FormRow[], fields: Fields): boolean {
  return missingRequired(form, fields).length === 0
}
