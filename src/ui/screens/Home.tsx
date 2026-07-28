/**
 * S0 홈 (랜딩) — 입구 + 공지 슬롯 + 몰 슬롯 (03 §4 S0).
 * 작업 목록이 아니다. 공지·스토어는 자리만 잡고 추후 서버 연결 시 채운다.
 */

import { rowsForRender } from '../../core/models'
import { previewFields, useStore } from '../state/store'

export default function Home() {
  const { state, dispatch } = useStore()
  const rows = rowsForRender(state.form, previewFields(state))

  const later = (what: string) =>
    dispatch({ type: 'snack', snack: { msg: `${what} — 추후 서버 연결 시` } })

  return (
    <div className="home">
      <Logo />
      <div className="brand-name">
        일보자
        <span className="brand-sub">작업한 내용을 사진에 담다</span>
      </div>

      <div className="hcard">
        {rows.length ? (
          rows.map((r) => (
            <div className="r" key={r.label}>
              <span className="k">{r.label}</span>
              <span className="v">{r.value}</span>
            </div>
          ))
        ) : (
          <div className="r">
            <span className="v" style={{ color: 'var(--dim)' }}>
              아직 입력된 값이 없습니다
            </span>
          </div>
        )}
      </div>

      <button className="run" onClick={() => dispatch({ type: 'go', screen: 'main' })}>
        보드판 실행 ▶
      </button>

      <div className="hsub">
        <button onClick={() => later('저장폴더 열기')}>📁 저장폴더</button>
        <button onClick={() => dispatch({ type: 'go', screen: 'settings' })}>⚙ 설정</button>
      </div>

      {/* 추후 확장 슬롯 — 지금은 자리만. 서버 통신 코드를 넣지 않는다(로컬 전용 원칙) */}
      <button className="hslot" onClick={() => later('공지사항')}>
        <b>📢 공지사항</b>
        <span>업데이트·안내가 여기 표시됩니다 (추후)</span>
      </button>
      <button className="hslot" onClick={() => later('스토어')}>
        <b>🛒 스토어</b>
        <span>측량깃발·규준틀 등 연결 (추후)</span>
      </button>
    </div>
  )
}

/** 확정 아이콘 (05.디자인/아이콘-확정.svg) */
function Logo() {
  return (
    <svg width="92" height="92" viewBox="0 0 512 512" aria-label="일보자">
      <rect width="512" height="512" rx="112" fill="#1a62d6" />
      <rect x="80" y="80" width="352" height="352" rx="24" fill="#fff" />
      <line x1="80" y1="180" x2="432" y2="180" stroke="#1a62d6" strokeWidth="20" />
      <line x1="80" y1="280" x2="432" y2="280" stroke="#1a62d6" strokeWidth="20" />
      <line x1="200" y1="80" x2="200" y2="432" stroke="#1a62d6" strokeWidth="20" />
      <circle cx="340" cy="340" r="100" fill="#ffd600" stroke="#1a62d6" strokeWidth="16" />
      <circle cx="340" cy="340" r="60" fill="#16181d" />
      <circle cx="340" cy="340" r="30" fill="#2d3139" />
      <circle cx="365" cy="315" r="14" fill="#fff" opacity="0.8" />
      <circle cx="320" cy="355" r="7" fill="#fff" opacity="0.5" />
    </svg>
  )
}
