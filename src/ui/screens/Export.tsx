/**
 * S3 내보내기 (03 §4 S3) — 선택 → 진행 → 완료.
 * 실제 인코딩·파일쓰기는 단계 3~5. 여기서는 화면 흐름과 경고를 갖춘다.
 */

import { useState } from 'react'
import { buildPath } from '../../core/path'
import { missingRequired } from '../../core/validate'
import { useStore } from '../state/store'

type Step = 'pick' | 'run' | 'done'
type Format = 'jpeg' | 'zip'

/** 실측 191ms/장 (00.요구사항 §5) */
const MS_PER_PHOTO = 191

export default function Export() {
  const { state, dispatch } = useStore()
  const [step, setStep] = useState<Step>('pick')
  const [format, setFormat] = useState<Format>('jpeg')
  const [done, setDone] = useState(0)
  // 크기는 설정의 「저장 이미지 해상도」 하나뿐이다. 여기서 따로 갖지 않는다 —
  // 같은 규칙이 두 곳에 있으면 반드시 갈라진다(폴더·파일명 규칙과 같은 이유)
  const size = state.cfg.saveRes

  const n = state.photos.length
  const bad = state.photos.filter((p) => missingRequired(state.form, p.fields).length).length
  const seconds = Math.max(1, Math.round((n * MS_PER_PHOTO) / 1000))

  // 폴더·파일명 규칙은 사용자가 「표 항목 관리」에서 지정한다. 여기서 하드코딩하지 않는다
  const sample = n
    ? `${state.cfg.folderPath}/${buildPath(
        state.photos[0].fields,
        {
          folderKeys: state.cfg.folderKeys,
          fileKeys: state.cfg.fileKeys,
          fallbackFolder: '미분류',
          fallbackFile: '사진',
        },
        1,
      )}`
    : null

  const start = () => {
    setStep('run')
    setDone(0)
    // 실제 인코딩 대신 진행률만 흉내낸다. 백그라운드 전환 시 20배 느려지는 것도 단계 5에서 대응
    let i = 0
    const tick = window.setInterval(() => {
      i += 1
      setDone(i)
      if (i >= n) {
        window.clearInterval(tick)
        dispatch({ type: 'markExported' })
        setStep('done')
      }
    }, 40)
  }

  return (
    <>
      <div className="hd">
        <button className="icob" onClick={() => dispatch({ type: 'go', screen: 'main' })}>
          ←
        </button>
        <h1>내보내기</h1>
      </div>

      <div className="body">
        {step === 'pick' && (
          <>
            {bad > 0 && (
              <p className="warn">
                ⚠ 확인 필요 {bad}장 — 필수 항목이 비어 있습니다. 먼저 채우시길 권합니다.
              </p>
            )}
            {n === 0 && <p className="note">내보낼 사진이 없습니다.</p>}

            <h3 style={{ fontSize: '0.94em', color: 'var(--dim)' }}>형식</h3>
            <div className="seg" style={{ marginBottom: 14 }}>
              <button aria-pressed={format === 'jpeg'} onClick={() => setFormat('jpeg')}>
                🖼 사진 파일
              </button>
              <button aria-pressed={format === 'zip'} onClick={() => setFormat('zip')}>
                📦 작업 꾸러미(.zip)
              </button>
            </div>
            <p className="note">
              {format === 'jpeg'
                ? '표가 찍힌 사진. 보고서·전달용.'
                : '원본 + 메타. 다른 사람이 받아서 다시 고칠 수 있습니다.'}
            </p>

            <h3 style={{ fontSize: '0.94em', color: 'var(--dim)' }}>크기</h3>
            <div className="seg" style={{ marginBottom: 6 }}>
              {['원본', '2048', '1280'].map((s) => (
                <button
                  key={s}
                  aria-pressed={size === s}
                  onClick={() => dispatch({ type: 'setCfg', patch: { saveRes: s } })}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="note">설정의 「저장 이미지 해상도」와 같은 값입니다.</p>

            {sample && (
              <p className="note">
                저장 경로 예시
                <br />
                <code>{sample}</code>
              </p>
            )}

            <button className="run" disabled={n === 0} onClick={start}>
              만들기 (약 {seconds}초)
            </button>
          </>
        )}

        {step === 'run' && (
          <>
            <p className="warn">⚠ 화면을 끄거나 다른 앱으로 가지 마세요</p>
            <p className="note">
              백그라운드로 가면 20배 느려집니다 (실측). 화면을 켜 둔 채로 기다려 주세요.
            </p>
            <h2>
              변환 중… ({done} / {n}장)
            </h2>
            <div style={{ height: 12, background: '#e6e9ee', borderRadius: 99 }}>
              <div
                style={{
                  width: `${n ? (done / n) * 100 : 0}%`,
                  height: '100%',
                  background: 'var(--brand)',
                  borderRadius: 99,
                  transition: 'width .1s',
                }}
              />
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <h2 style={{ marginTop: 0 }}>✅ 완료 {n}장</h2>

            {/* 전송 방식 대조표 — 문장보다 대조표가 명확하다.
                제목을 "카톡 전송"으로 못 박는다. 실제로 사진이 죽는 경로가 거기다 */}
            <div className="sect">카톡 전송</div>
            <div className="cmp">
              <div>
                <b style={{ color: 'var(--bad)' }}>❌ 사진으로 전송</b>
                <small>재편집 불가 · 화질 저하 (메신저가 재압축하면 메타가 전멸합니다)</small>
              </div>
              <div>
                <b style={{ color: 'var(--after)' }}>⭕ 파일(문서)로 전송</b>
                <small>재편집 가능 · 고화질 유지</small>
              </div>
            </div>

            <div className="seg">
              <button onClick={() => dispatch({ type: 'snack', snack: { msg: '.zip 공유 (단계 5)' } })}>
                📦 .zip 공유
              </button>
              <button onClick={() => dispatch({ type: 'snack', snack: { msg: 'JPEG 공유 (단계 5)' } })}>
                🖼 JPEG 공유
              </button>
            </div>

            <button
              className="run"
              style={{ marginTop: 16 }}
              onClick={() => dispatch({ type: 'go', screen: 'main' })}
            >
              돌아가기
            </button>
          </>
        )}
      </div>
    </>
  )
}
