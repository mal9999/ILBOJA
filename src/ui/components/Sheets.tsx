/**
 * 입력 시트 · 일괄 시트 · 이름변경 시트 (03 §2.6 · §2.7).
 *
 * 일괄의 **주 입구는 입력 시트 하단의 `여러 장에 적용 ▸` 버튼**이다.
 * 롱프레스(EditTable)는 보조다 — 고령 사용자는 롱프레스를 발견하지 못한다.
 */

import { useState } from 'react'
import { currentFields, useStore, type BulkRange } from '../state/store'

export default function Sheets() {
  const { state, dispatch } = useStore()
  const sheet = state.sheet
  if (!sheet) return null

  const close = () => dispatch({ type: 'sheet', sheet: null })

  return (
    <div
      className="sheetwrap"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="sheet">
        {sheet.kind === 'which' && <WhichSheet keyName={sheet.key} />}
        {sheet.kind === 'input' && <InputSheet keyName={sheet.key} />}
        {sheet.kind === 'default' && <DefaultSheet keyName={sheet.key} />}
        {sheet.kind === 'bulk' && <BulkSheet keyName={sheet.key} value={sheet.value} />}
        {sheet.kind === 'rename' && <RenameSheet keyName={sheet.key} />}
        <button className="opt" onClick={close}>
          취소
        </button>
      </div>
    </div>
  )
}

/**
 * **무엇을 고칠 것인가** (2026-07-30 사용자 결정).
 *
 * 사진을 골라 본 뒤 표를 누르면 두 가지로 읽힌다 — 그 사진을 고치려는 것이거나,
 * 다음 촬영 준비이거나. 앱이 몰래 정하면 사진이 오염된다(실제로 그랬다). 그래서 한 번 묻는다.
 * 주 동선(찍고 바로 다음 값 넣기)에서는 이 시트가 뜨지 않는다.
 */
function WhichSheet({ keyName }: { keyName: string }) {
  const { state, dispatch } = useStore()
  const row = state.form.find((r) => r.key === keyName)!
  const n = state.cur + 1

  const go = (mode: 'shoot' | 'edit') => {
    dispatch({ type: 'mode', mode })
    dispatch({
      type: 'sheet',
      sheet:
        mode === 'shoot' && row.kind === 'auto'
          ? { kind: 'default', key: keyName }
          : { kind: 'input', key: keyName },
    })
  }

  return (
    <>
      <h3>「{row.label.replace(/\s+/g, '')}」 어느 쪽인가요?</h3>
      <button className="opt primary" onClick={() => go('shoot')}>
        <span>📷 다음 촬영 준비입니다</span>
        <small>찍은 사진은 안 바뀝니다</small>
      </button>
      <button className="opt" onClick={() => go('edit')}>
        <span>✏ {n}번 사진을 고칩니다</span>
        <small>이 사진에만 적용</small>
      </button>
    </>
  )
}

function InputSheet({ keyName }: { keyName: string }) {
  const { state, dispatch } = useStore()
  const row = state.form.find((r) => r.key === keyName)!
  const fields = currentFields(state)
  const [custom, setCustom] = useState('')

  const set = (value: string) => dispatch({ type: 'setValue', key: keyName, value })

  if (row.input === 'ho') return <HoPad keyName={keyName} />

  const options = row.options ?? []
  const history = state.history[keyName] ?? []
  const chips = [...new Set([...options, ...history])]

  return (
    <>
      <h3>{row.label}</h3>

      {chips.map((v) => (
        <button key={v} className="opt" onClick={() => set(v)}>
          <span>{v}</span>
          {!options.includes(v) && <small>내가 추가</small>}
        </button>
      ))}

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="padval"
          style={{ flex: 1, minWidth: 0 }}
          placeholder="직접 입력"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && custom.trim()) set(custom.trim())
          }}
        />
        <button
          className="opt primary"
          style={{ flex: '0 0 auto' }}
          onClick={() => custom.trim() && set(custom.trim())}
        >
          확인
        </button>
      </div>

      {state.photos.length > 1 && (
        <button
          className="opt primary"
          onClick={() =>
            dispatch({
              type: 'sheet',
              sheet: { kind: 'bulk', key: keyName, value: fields[keyName] ?? '' },
            })
          }
        >
          여러 장에 적용 ▸
        </button>
      )}
    </>
  )
}

/**
 * 서식 기본값(Form.default) 편집 — 사진 값이 아니다.
 * 여기를 고쳐도 이미 찍은 사진은 안 바뀐다(§3). 그래서 그 사실을 화면에 적어 둔다.
 */
function DefaultSheet({ keyName }: { keyName: string }) {
  const { state, dispatch } = useStore()
  const row = state.form.find((r) => r.key === keyName)!
  const [text, setText] = useState(row.default ?? '')
  const history = state.history[keyName] ?? []

  const save = (v: string) => v.trim() && dispatch({ type: 'setDefault', key: keyName, value: v.trim() })

  return (
    <>
      <h3>{row.label} 기본값</h3>
      <p className="note" style={{ margin: 0 }}>
        다음에 찍을 사진부터 적용됩니다. <b>이미 찍은 사진은 안 바뀝니다.</b>
      </p>
      <input
        className="padval"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save(text)}
      />
      {history.slice(0, 6).map((v) => (
        <button key={v} className="opt" onClick={() => save(v)}>
          {v}
        </button>
      ))}
      <button className="opt primary" onClick={() => save(text)}>
        확인
      </button>
    </>
  )
}

/** 동/호수 — 대형 숫자 키패드. 접근성 48/60px 을 시스템 키보드로는 못 지킨다 */
function HoPad({ keyName }: { keyName: string }) {
  const { state, dispatch } = useStore()
  const row = state.form.find((r) => r.key === keyName)!
  const [buf, setBuf] = useState('')
  const history = state.history[keyName] ?? []

  const add = (t: string) => setBuf((b) => b + t)

  return (
    <>
      <h3>{row.label}</h3>
      <div className="padval">{buf || ' '}</div>
      <div className="pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '동', '0', '호'].map((t) => (
          <button key={t} onClick={() => add(t)}>
            {t}
          </button>
        ))}
        <button onClick={() => setBuf((b) => b.slice(0, -1))}>⌫</button>
        <button onClick={() => add(' ')}>공백</button>
        <button
          style={{ borderColor: 'var(--brand)', color: 'var(--brand)', fontWeight: 700 }}
          onClick={() => buf.trim() && dispatch({ type: 'setValue', key: keyName, value: buf.trim() })}
        >
          확인
        </button>
      </div>

      {history.length > 0 && (
        <>
          <h3 style={{ marginTop: 10 }}>최근</h3>
          {history.slice(0, 6).map((v) => (
            <button
              key={v}
              className="opt"
              onClick={() => dispatch({ type: 'setValue', key: keyName, value: v })}
            >
              {v}
            </button>
          ))}
        </>
      )}
    </>
  )
}

/** 일괄 시트 — 반드시 몇 장인지 숫자로 보여준다 */
function BulkSheet({ keyName, value }: { keyName: string; value: string }) {
  const { state, dispatch } = useStore()
  const row = state.form.find((r) => r.key === keyName)!
  const fromHere = state.photos.length - state.cur
  const all = state.photos.length

  const apply = (range: BulkRange) => dispatch({ type: 'bulk', key: keyName, value, range })

  const opts: [BulkRange, string][] = [
    ['one', '이 사진만'],
    ['fromHere', `이 사진부터 끝까지 ${fromHere}장`],
    ['all', `전체 ${all}장`],
  ]

  return (
    <>
      <h3>
        「{row.label.replace(/\s+/g, '')}」 = {value || '(빈 값)'}
      </h3>
      {opts.map(([r, t]) => (
        <button key={r} className="opt" onClick={() => apply(r)}>
          {t}
        </button>
      ))}
    </>
  )
}

function RenameSheet({ keyName }: { keyName: string }) {
  const { state, dispatch } = useStore()
  const row = state.form.find((r) => r.key === keyName)!
  const [label, setLabel] = useState(row.label.trim())

  return (
    <>
      <h3>항목 이름 바꾸기</h3>
      <p className="note" style={{ margin: 0 }}>
        보이는 이름만 바뀝니다. 저장되는 값과 폴더명은 그대로예요.
      </p>
      <input
        className="padval"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && label.trim())
            dispatch({ type: 'renameRow', key: keyName, label: label.trim() })
        }}
      />
      <button
        className="opt primary"
        onClick={() => label.trim() && dispatch({ type: 'renameRow', key: keyName, label: label.trim() })}
      >
        확인
      </button>
    </>
  )
}
