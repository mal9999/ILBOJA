/**
 * S4 설정 (03 §4 S4 · 04.mock/app.html `paintSet`).
 * 그룹 3개로 묶는다 — 접근성(우리 추가) · 보드판 설정(동산 대응) · 양식·저장.
 */

import { DEFAULT_STYLE, type StampBg, type StampPos, type StampStyle } from '../../core/renderStamp'
import { useStore } from '../state/store'

const POS: [StampPos, string][] = [
  ['tl', '좌상'],
  ['tr', '우상'],
  ['bl', '좌하'],
  ['br', '우하'],
]
const BG: [StampBg, string][] = [
  ['white', '흰색'],
  ['transparent', '투명'],
  ['none', '테두리 없음'],
]
const ALIGN: [StampStyle['align'], string][] = [
  ['left', '좌'],
  ['center', '중앙'],
  ['right', '우'],
]
/**
 * 촬영 크기. **비율이 곧 촬영 화면의 크기다** — 이 문자열의 W×H 를 그대로 읽어(`camSize`)
 * 프리뷰 사각형을 잡는다(`Camera.tsx` 의 `frameFor`).
 *
 * 16:9 를 넣은 이유: 4:3 은 20:9 폰 화면에서 **긴 변의 24%가 검게 남는다.** 16:9 로 찍으면
 * 프리뷰가 33% 커지고 검은 띠가 거의 사라진다. 대신 **사진 화각이 위아래로 잘려** 4:3 보다
 * 적게 담긴다 — 벽·천장 하자를 넓게 담아야 하면 4:3 이 낫다. 그래서 고르게 뒀다.
 */
const CAM_RES = [
  '4080 × 3060 (4:3)',
  '3264 × 2448 (4:3)',
  '1920 × 1440 (4:3)',
  '4080 × 2296 (16:9)',
  '1920 × 1080 (16:9)',
]
const SAVE_RES = ['원본', '2048', '1280']

export default function Settings() {
  const { state, dispatch } = useStore()
  const autos = state.form.filter((r) => r.kind === 'auto' && r.key !== 'date')

  // 화면에는 배율(%)로 보여준다. 폭 대비 2.6%가 기본 = 100%
  const scale = Math.round((state.style.fontRatio / DEFAULT_STYLE.fontRatio) * 100)

  return (
    <>
      <div className="hd">
        <button className="icob" onClick={() => dispatch({ type: 'go', screen: 'main' })}>
          ←
        </button>
        <h1>설정</h1>
      </div>

      <div className="body">
        <Group title="접근성 (우리 추가)">
          <Row label="🔍 큰글씨 모드">
            <div className="seg">
              {[false, true].map((v) => (
                <button
                  key={String(v)}
                  aria-pressed={state.bigText === v}
                  onClick={() => dispatch({ type: 'bigText', on: v })}
                >
                  {v ? '켬' : '끔'}
                </button>
              ))}
            </div>
          </Row>
        </Group>

        <Group title="보드판 설정 (동산 대응 · 사진에 즉시 반영)">
          <Row label="글자 크기">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="range"
                min={60}
                max={180}
                step={5}
                value={scale}
                onChange={(e) =>
                  dispatch({
                    type: 'setStyle',
                    patch: { fontRatio: (DEFAULT_STYLE.fontRatio * Number(e.target.value)) / 100 },
                  })
                }
                style={{ flex: 1 }}
              />
              <b style={{ minWidth: 46, textAlign: 'right' }}>{scale}%</b>
            </div>
          </Row>

          <Row label="보드판 위치">
            <Seg
              items={POS}
              value={state.style.pos}
              onPick={(v) => dispatch({ type: 'setStyle', patch: { pos: v } })}
            />
          </Row>

          <Row label="보드판 색상">
            <Seg
              items={BG}
              value={state.style.bg}
              onPick={(v) => dispatch({ type: 'setStyle', patch: { bg: v } })}
            />
          </Row>

          {/* 경쟁앱 최다 요청(51명) — "엑셀처럼 중앙 기준 정렬". 목업엔 없어 새로 넣었다 */}
          <Row label="값 정렬">
            <Seg
              items={ALIGN}
              value={state.style.align}
              onPick={(v) => dispatch({ type: 'setStyle', patch: { align: v } })}
            />
          </Row>

          <Row label="보드판 폰트">
            <div className="seg">
              <button aria-pressed>{state.cfg.font}</button>
              <button onClick={() => dispatch({ type: 'snack', snack: { msg: '무료폰트 설치 (2차)' } })}>
                무료폰트 설치…
              </button>
            </div>
          </Row>

          <Row label="카메라 해상도">
            <Sel
              items={CAM_RES}
              value={state.cfg.camRes}
              onPick={(v) => dispatch({ type: 'setCfg', patch: { camRes: v } })}
            />
          </Row>

          <Row label="저장 이미지 해상도">
            <Sel
              items={SAVE_RES}
              value={state.cfg.saveRes}
              onPick={(v) => dispatch({ type: 'setCfg', patch: { saveRes: v } })}
            />
          </Row>
        </Group>

        <Group title="양식 · 저장">
          <button className="srow" onClick={() => dispatch({ type: 'go', screen: 'form' })}>
            <span className="lb">표 항목 관리</span>
            <span className="val">항목·폴더명·파일명 ▸</span>
          </button>

          <button className="srow" onClick={() => dispatch({ type: 'go', screen: 'form' })}>
            <span className="lb">폴더·파일명 규칙</span>
            <span className="val">표 항목 관리에서 ▸</span>
          </button>

          <button
            className="srow"
            onClick={() =>
              dispatch({
                type: 'snack',
                snack: { msg: '직접 입력값이 여기 쌓입니다. 오타는 삭제 (관리 화면은 단계 7)' },
              })
            }
          >
            <span className="lb">입력 이력</span>
            <span className="val">
              최근 {state.cfg.histCount}개 · {Object.values(state.history).flat().length}건 ▸
            </span>
          </button>

          <button
            className="srow"
            onClick={() =>
              dispatch({ type: 'snack', snack: { msg: '휴지통: 30일 보관 후 자동 삭제' } })
            }
          >
            <span className="lb">휴지통</span>
            <span className="val">{state.trash.length}장 · 30일 보관 ▸</span>
          </button>
        </Group>

        <Group title="기본값 (자동 항목)">
          <p className="note">
            여기를 바꿔도 <b>이미 찍은 사진은 안 바뀝니다.</b> 과거 사진을 고치려면 표에서 직접
            누르거나 「여러 장에 적용」을 쓰세요.
          </p>
          {autos.map((r) => (
            <button
              key={r.key}
              className="srow"
              onClick={() => dispatch({ type: 'sheet', sheet: { kind: 'default', key: r.key } })}
            >
              <span className="lb">{r.label}</span>
              <span className="val">{r.default || '(없음)'} ▸</span>
            </button>
          ))}
        </Group>
      </div>
    </>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sgrp">
      <div className="gh">{title}</div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="srow2 col">
      <span className="lb">{label}</span>
      {children}
    </div>
  )
}

function Seg<T extends string>({
  items,
  value,
  onPick,
}: {
  items: [T, string][]
  value: T
  onPick: (v: T) => void
}) {
  return (
    <div className="seg">
      {items.map(([v, t]) => (
        <button key={v} aria-pressed={value === v} onClick={() => onPick(v)}>
          {t}
        </button>
      ))}
    </div>
  )
}

function Sel({
  items,
  value,
  onPick,
}: {
  items: string[]
  value: string
  onPick: (v: string) => void
}) {
  return (
    <select className="chip" value={value} onChange={(e) => onPick(e.target.value)}>
      {items.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  )
}
