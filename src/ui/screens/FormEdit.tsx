/**
 * S5 표 항목 관리 (03 §4 S5 · 04.mock/app.html `paintForm`).
 *
 * `03` S5 는 "이름변경 + 켜기/끄기"로 축약돼 있지만, 00.요구사항은 더 요구한다 —
 * §6.3 "이름·값·**순서·개수**를 자유롭게 변경", §6.4 "표 항목을 **폴더명·파일명으로 지정**".
 * 폴더·파일명 지정은 경쟁 앱의 최대 강점("알아서 정리돼서 찾기 편하다")이라 빠뜨릴 수 없다.
 *
 * key 는 여전히 고정이다. 바꿀 수 있는 건 label·순서·표시여부·경로 지정뿐.
 */

import { useState } from 'react'
import { buildPath } from '../../core/path'
import { previewFields, useStore } from '../state/store'

const KIND_LABEL: Record<string, string> = { auto: '자동', slate: '찍을때', phase: '전/후' }

export default function FormEdit() {
  const { state, dispatch } = useStore()
  const [adding, setAdding] = useState('')
  const rows = [...state.form].sort((a, b) => a.order - b.order)
  const on = rows.filter((r) => r.on)
  const fields = previewFields(state)

  const inFolder = (k: string) => state.cfg.folderKeys.includes(k)
  const inFile = (k: string) => state.cfg.fileKeys.includes(k)

  return (
    <>
      <div className="hd">
        <button className="icob" onClick={() => dispatch({ type: 'go', screen: 'settings' })}>
          ←
        </button>
        <h1>표 항목</h1>
      </div>

      <div className="body">
        <p className="note">
          <span style={{ color: '#d92d20' }}>▊</span> 폴더명 ·{' '}
          <span style={{ color: 'var(--brand)' }}>▊</span> 파일명 표시. 셀병합은 제외(2열 고정).
        </p>

        {/* 표 미리보기 — 켜진 항목이 어떤 순서로 나오는지 */}
        <div className="fprev">
          {on.map((r) => (
            <div className="tr" key={r.key}>
              <div className="tk">
                {inFolder(r.key) && <span className="bar fold" />}
                {inFile(r.key) && <span className="bar file" />}
                {r.label}
              </div>
              {/* previewFields 가 auto 값(날짜 포함)까지 이미 채워 준다 — default 를 따로 읽지 않는다 */}
              <div className="tv">{fields[r.key] || '…'}</div>
            </div>
          ))}
          {!on.length && <div className="tr">켜진 항목이 없습니다</div>}
        </div>

        {/* 경로 미리보기 — 지정이 실제로 어떤 폴더·파일명이 되는지 (03 §4 S4) */}
        <p className="note">
          저장 경로 미리보기
          <br />
          <code>
            {state.cfg.folderPath}/
            {buildPath(fields, {
              folderKeys: state.cfg.folderKeys,
              fileKeys: state.cfg.fileKeys,
              fallbackFolder: '미분류',
              fallbackFile: '사진',
            }, 1)}
          </code>
        </p>

        <div className="sect">항목 (순서 ▲▼ · 이름 ✏️ · 폴더/파일명 지정 · 켜기/끄기)</div>

        {rows.map((r, i) => (
          <div className="fitem" key={r.key}>
            <button
              className="mini"
              title="이름 바꾸기"
              onClick={() => dispatch({ type: 'sheet', sheet: { kind: 'rename', key: r.key } })}
            >
              ✏️
            </button>
            <span className="nm">
              {r.label}
              <small> · {KIND_LABEL[r.kind]}</small>
            </span>
            <button
              className={`tag ${inFolder(r.key) ? 'fold' : ''}`}
              onClick={() => dispatch({ type: 'togglePathKey', which: 'folderKeys', key: r.key })}
            >
              폴더명
            </button>
            <button
              className={`tag ${inFile(r.key) ? 'file' : ''}`}
              onClick={() => dispatch({ type: 'togglePathKey', which: 'fileKeys', key: r.key })}
            >
              파일명
            </button>
            <button
              className="mini"
              disabled={i === 0}
              onClick={() => dispatch({ type: 'moveRow', key: r.key, delta: -1 })}
            >
              ▲
            </button>
            <button
              className="mini"
              disabled={i === rows.length - 1}
              onClick={() => dispatch({ type: 'moveRow', key: r.key, delta: 1 })}
            >
              ▼
            </button>
            <button
              className={`onoff ${r.req ? 'req' : r.on ? 'on' : ''}`}
              disabled={r.req}
              onClick={() => dispatch({ type: 'toggleRow', key: r.key })}
            >
              {r.req ? '필수' : r.on ? '켜짐' : '끔'}
            </button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
          <input
            className="padval"
            style={{ flex: 1, minWidth: 0 }}
            placeholder="＋ 항목 추가 (예: 비고)"
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && adding.trim()) {
                dispatch({ type: 'addRow', label: adding })
                setAdding('')
              }
            }}
          />
          <button
            className="opt primary"
            style={{ flex: '0 0 auto' }}
            onClick={() => {
              if (!adding.trim()) return
              dispatch({ type: 'addRow', label: adding })
              setAdding('')
            }}
          >
            추가
          </button>
        </div>

        <div className="sect">저장</div>

        <div className="srow2">
          <span className="lb">저장폴더 경로</span>
          <button
            className="chip"
            onClick={() =>
              dispatch({ type: 'snack', snack: { msg: 'Android 는 루트 고정 — 그 아래는 자유 (단계 5)' } })
            }
          >
            {state.cfg.folderPath}
          </button>
        </div>

        <div className="srow2">
          <span className="lb">원본 이미지 저장</span>
          <span className="val">
            ✓ 항상 켜짐 <small>(비파괴 — 못 끔)</small>
          </span>
        </div>

        <div className="srow2">
          <span className="lb">문자열 저장 갯수</span>
          <input
            className="chip"
            style={{ width: 76, textAlign: 'center' }}
            value={state.cfg.histCount}
            onChange={(e) =>
              dispatch({ type: 'setCfg', patch: { histCount: Number(e.target.value) || 50 } })
            }
          />
        </div>

        <button
          className="opt"
          style={{ marginTop: 12 }}
          onClick={() => dispatch({ type: 'resetForm' })}
        >
          초기화
        </button>
      </div>
    </>
  )
}
