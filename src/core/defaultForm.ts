/**
 * 기본 서식 — 앱 최초 실행 시 seed.
 * 정본: 03.화면-표준스펙.md §3 "기본 서식"
 */

import type { FormRow } from './models'

export const DEFAULT_FORM: FormRow[] = [
  { key: 'danji', label: '단  지', kind: 'auto', on: true, req: false, order: 1 },
  { key: 'ho', label: '동/호수', kind: 'slate', on: true, req: true, order: 2, input: 'ho' },
  {
    key: 'work',
    label: '작업내용',
    kind: 'slate',
    on: true,
    req: true,
    order: 3,
    input: 'choice',
    options: ['누수 보수', '균열 보수', '결로 처리', '창호 교체', '타일 보수', '도배'],
  },
  {
    // 기본 꺼짐. 요구사항의 "위치"는 GPS 이야기였고(00 §4), 실내 부위를 입력받으라는
    // 요구는 없다. 지우지 않는 건 파일명 규칙(00 §6.4)이 참조할 수 있고,
    // 서식 켜기/끄기 구조가 정확히 이런 경우를 위한 장치이기 때문. 상세는 03 §3.
    key: 'loc',
    label: '위  치',
    kind: 'slate',
    on: false,
    req: false,
    order: 4,
    input: 'choice',
    options: ['거실 천장', '거실 벽', '안방 천장', '안방 발코니', '욕실 바닥', '주방 싱크대'],
  },
  { key: 'phase', label: '구  분', kind: 'phase', on: true, req: true, order: 5 },
  { key: 'date', label: '작업일자', kind: 'auto', on: true, req: false, order: 6 },
  { key: 'worker', label: '작 업 자', kind: 'auto', on: true, req: false, order: 7 },
]
