/**
 * 데이터 모델 — 순수 TypeScript. 플랫폼·DOM 의존 없음.
 *
 * 정본: D:\workspace_local\Document\사진보드판\02.아키텍처.md §3
 *      = 03.화면-표준스펙.md §3 (두 문서가 항상 같아야 한다)
 */

/** 항목의 계층. 값이 어디서 오고 어떻게 편집되는지를 결정한다. */
export type FieldKind =
  | 'auto' // 단지·작업일자·작업자 — 설정에서 기본값이 자동 승계됨
  | 'slate' // 동/호수·작업내용·위치 — 찍을 때마다 넣는 값
  | 'phase' // 구분(작업 전/후) — 2버튼 토글

export type InputKind = 'choice' | 'ho'

/** 표 한 장의 값. key → 값. */
export type Fields = Record<string, string>

/** 서식 한 벌의 항목. 설정에서 켜기/끄기·이름변경만 가능하다. */
export interface FormRow {
  /** 고정. label만 바꿀 수 있다 = 데이터 파편화 방지 */
  key: string
  label: string
  kind: FieldKind
  on: boolean
  req: boolean
  order: number
  input?: InputKind
  options?: string[]
  /** kind:'auto' 의 "다음 촬영 기본값". 표에 그려지는 값이 아니다 (snapshotFields 참고) */
  default?: string
}

export interface Photo {
  id: string
  capturedAt: string
  /** 현재 항상 'default'. 서식 여러 벌 확장 대비 자리만 확보 */
  templateId: string
  phase: string
  /** 촬영 시점에 확정된 표 값 전부. 표는 이것만 보고 그린다 */
  fields: Fields
  originalPath: string
  sha256: string
  thumb320Path: string
  rev: number
  exportedRev: number
  /** 휴지통. 있으면 삭제된 것 */
  deletedAt?: string
}

/** 개인 입력이력 — 입력 시트의 칩 재료 */
export interface HistoryEntry {
  key: string
  value: string
  count: number
}

/**
 * 촬영 시점에 표 값 **전부**를 사진으로 복사한다.
 *
 * auto 항목까지 포함하는 것이 핵심이다. 렌더할 때 FormRow.default 를 읽으면
 * 설정에서 작업자를 바꾸는 순간 과거 사진의 표까지 소급해서 바뀌고,
 * 작업일자는 앱을 켠 날로 계산돼 어제 찍은 사진이 오늘 날짜로 그려진다.
 * 보고서용 산출물에서 치명적이라 값의 소유자는 언제나 Photo 다.
 *
 * @param base       직전 사진(또는 slate)의 값 — slate/phase 항목이 여기서 승계된다
 * @param autoValues 촬영 시점에 확정된 auto 값 (예: { date: '2026-07-27' }).
 *                   없으면 FormRow.default 로 떨어진다. 날짜처럼 "지금" 계산해야 하는 값을 넣는다
 */
export function snapshotFields(
  form: FormRow[],
  base: Fields,
  autoValues: Fields = {},
): Fields {
  const f: Fields = {}
  for (const row of form) {
    f[row.key] =
      row.kind === 'auto'
        ? (autoValues[row.key] ?? row.default ?? '')
        : (base[row.key] ?? '')
  }
  return f
}

/**
 * 표에 그릴 행 목록.
 *
 * **값은 사진에서(복사), 라벨은 서식에서(참조).** 라벨을 서식에서 읽는 건 의도된 것이다 —
 * "작 업 자"를 "담당자"로 바꾸면 과거 사진 표에도 반영되는 게 맞다. 부르는 이름이 바뀐 것이지
 * 데이터가 바뀐 게 아니고, key 가 고정이라 폴더명·집계도 안 깨진다.
 */
export function rowsForRender(
  form: FormRow[],
  fields: Fields,
): { label: string; value: string }[] {
  return form
    .filter((r) => r.on)
    .sort((a, b) => a.order - b.order)
    .map((r) => ({ label: r.label, value: fields[r.key] ?? '' }))
    .filter((r) => r.value.trim() !== '') // 빈 값 행은 표에서 자동 제외
}
