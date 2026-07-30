/**
 * S3 내보내기 (03 §4 S3) — 선택 → 진행 → 완료.
 *
 * 여기가 **폴더 자동정리가 실현되는 유일한 지점**이다(`00` §8 경쟁앱 최대 강점).
 * 표를 구운 JPEG 을 `buildPath` 가 정한 경로로 저장한다 — 경로 규칙은 「표 항목 관리」(S5)가
 * 정하고 여기서는 읽기만 한다. 같은 규칙이 두 곳에 있으면 반드시 갈라진다.
 */

import { useState } from 'react'
import { rowsForRender, type FormRow, type Photo } from '../../core/models'
import { buildPath, type PathConfig } from '../../core/path'
import { renderStamp, type StampStyle } from '../../core/renderStamp'
import { missingRequired } from '../../core/validate'
import { usePorts } from '../state/ports'
import { useStore, type Config } from '../state/store'

type Step = 'pick' | 'run' | 'done'
type Format = 'jpeg' | 'zip'

/** 실측 191ms/장 (00.요구사항 §5) */
const MS_PER_PHOTO = 191

const pathConfig = (cfg: Config): PathConfig => ({
  folderKeys: cfg.folderKeys,
  fileKeys: cfg.fileKeys,
  fallbackFolder: '미분류',
  fallbackFile: '사진',
})

/**
 * 표를 구운 JPEG 한 장을 만든다.
 *
 * **화면용 축소본이 아니라 원본에서 다시 그린다.** 화면은 긴 변 1920 으로 줄여 들고 있지만
 * 산출물은 보고서에 들어가므로 설정한 저장 해상도를 그대로 따른다 (02 §4).
 */
async function bake(
  blob: Blob,
  photo: Photo,
  form: FormRow[],
  style: StampStyle,
  saveRes: string,
  /** 디코드/인코드 소요를 따로 담아 간다 — "굽기 2791ms" 만으로는 어디를 고칠지 모른다 */
  took: { decode: number; encode: number },
): Promise<Blob> {
  const long = Math.max(photo.width, photo.height)
  const target = saveRes === '원본' ? long : Number(saveRes) || long
  const k = Math.min(1, target / long)

  const t0 = performance.now()
  const bitmap = await createImageBitmap(blob, {
    imageOrientation: 'from-image',
    ...(k < 1
      ? { resizeWidth: Math.round(photo.width * k), resizeQuality: 'high' as const }
      : {}),
  })
  took.decode += performance.now() - t0

  // 그리기까지 굽기에 넣는다 — 어디에도 안 담기는 시간이 있으면 합이 안 맞아 또 헤맨다
  const t1 = performance.now()
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  /**
   * `willReadFrequently` — 캔버스를 **CPU 쪽에** 둔다.
   *
   * 없으면 캔버스가 GPU 에 올라가고, `toBlob` 이 픽셀을 도로 읽어 와야 해서 그 전송이 비싸다.
   * 실기기에서 인코딩이 **0.76MP 에 599ms**(≈800ms/MP)로 정상의 6~10배였다 —
   * 출력 픽셀에 정비례하는 것도 읽기 비용의 모습이다 (2026-07-30).
   * 우리는 그린 뒤 곧바로 한 번 읽고 버린다. GPU 에 둘 이유가 없다.
   */
  const g = canvas.getContext('2d', { willReadFrequently: true })!
  g.drawImage(bitmap, 0, 0)
  bitmap.close() // 다음 장을 위해 즉시 놓는다

  renderStamp(g, canvas.width, canvas.height, rowsForRender(form, photo.fields), style)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        took.encode += performance.now() - t1
        b ? resolve(b) : reject(new Error('JPEG 인코딩 실패'))
      },
      'image/jpeg',
      0.92,
    )
  })
}

export default function Export() {
  const { state, dispatch } = useStore()
  const ports = usePorts()
  const [step, setStep] = useState<Step>('pick')
  const [format, setFormat] = useState<Format>('jpeg')
  const [done, setDone] = useState(0)
  const [savedAt, setSavedAt] = useState('')
  const [failed, setFailed] = useState(0)
  /** 장당 평균 소요 — "여전히 느리다"(실기기)를 어디가 느린지로 좁히려고 잰다 (2026-07-30) */
  const [ms, setMs] = useState<{
    read: number
    decode: number
    encode: number
    write: number
    /** 실제 걸린 시간. 겹쳐 돌리므로 장당 합계보다 짧다 — 이게 사용자가 겪는 시간이다 */
    total: number
    lanes: number
    px: string
  } | null>(null)
  // 크기는 설정의 「저장 이미지 해상도」 하나뿐이다. 여기서 따로 갖지 않는다 —
  // 같은 규칙이 두 곳에 있으면 반드시 갈라진다(폴더·파일명 규칙과 같은 이유)
  const size = state.cfg.saveRes

  const n = state.photos.length
  const bad = state.photos.filter((p) => missingRequired(state.form, p.fields).length).length
  const seconds = Math.max(1, Math.round((n * MS_PER_PHOTO) / 1000))

  // 폴더·파일명 규칙은 사용자가 「표 항목 관리」에서 지정한다. 여기서 하드코딩하지 않는다
  const sample = n
    ? `${state.cfg.folderPath}/${buildPath(state.photos[0].fields, pathConfig(state.cfg), 1)}`
    : null

  const start = async () => {
    setStep('run')
    setDone(0)
    setFailed(0)

    let ok = 0
    let miss = 0
    let at = ''
    let read = 0
    let write = 0
    let px = ''
    const took = { decode: 0, encode: 0 }
    const startedAt = performance.now()

    /**
     * 여러 장을 **동시에** 굽는다.
     *
     * 실기기 계측에서 인코딩이 출력 픽셀에 **정비례**했다(0.76MP 599ms · 3.1MP 2443ms ≈ 790ms/MP).
     * 고정 비용이 아니라 CPU 일이라는 뜻이고, 사진끼리는 완전히 독립이므로 겹쳐 돌리면 된다.
     * `toBlob` 은 이미 백그라운드에서 인코딩하므로 워커 없이도 겹친다.
     *
     * 다만 겹친 수만큼 메모리도 겹친다 — 「원본」 저장은 12MP 그대로라 한 장씩 간다 (02 §4).
     */
    const lanes = size === '원본' ? 1 : 3
    let next = 0
    let finished = 0

    /**
     * **쓰기만 줄 세운다.** 장당 40ms 라 겹쳐 봐야 얻는 게 없는데,
     * 같은 폴더를 동시에 만들다 부딪힐 여지는 남는다. 굽기(수백 ms)만 겹치면 충분하다.
     */
    let chain: Promise<unknown> = Promise.resolve()
    const writeInTurn = (relPath: string, jpeg: Blob) => {
      const done = chain.then(() => ports.share.writeExport(relPath, jpeg))
      chain = done.catch(() => {}) // 한 장이 실패해도 줄은 계속 간다
      return done
    }

    const worker = async () => {
      for (;;) {
        const i = next++
        if (i >= n) return
        const photo = state.photos[i]
        try {
          const t0 = performance.now()
          const blob = await ports.db.getBlob(photo.id, 'original')
          if (!blob) throw new Error('원본을 찾을 수 없습니다')
          const t1 = performance.now()
          const jpeg = await bake(blob, photo, state.form, state.style, size, took)
          const t2 = performance.now()
          at = await writeInTurn(buildPath(photo.fields, pathConfig(state.cfg), i + 1), jpeg)
          read += t1 - t0
          write += performance.now() - t2
          px = `${photo.width}×${photo.height}`
          ok++
        } catch {
          miss++ // 한 장이 실패해도 나머지는 끝까지 간다. 몇 장이 빠졌는지는 말해 준다
        }
        setDone(++finished)
      }
    }
    await Promise.all(Array.from({ length: Math.min(lanes, n) }, worker))

    if (ok)
      setMs({
        read: read / ok,
        decode: took.decode / ok,
        encode: took.encode / ok,
        write: write / ok,
        total: performance.now() - startedAt,
        lanes,
        px,
      })
    setSavedAt(at)
    setFailed(miss)
    // 다 나갔을 때만 "내보냄"으로 표시한다. 실패분이 있는데 최신으로 찍으면 거짓말이 된다
    if (ok === n) dispatch({ type: 'markExported' })
    setStep('done')
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
                : '원본 + 메타. 다른 사람이 받아서 다시 고칠 수 있습니다. (단계 5)'}
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

            <button className="run" disabled={n === 0 || format === 'zip'} onClick={start}>
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
            <h2 style={{ marginTop: 0 }}>
              {failed ? `⚠ ${n - failed}장 완료 · ${failed}장 실패` : `✅ 완료 ${n}장`}
            </h2>
            {savedAt && (
              <p className="note">
                저장 위치
                <br />
                <code>{savedAt}</code>
              </p>
            )}
            {/* 어디가 느린지 폰에서 바로 보이게. 원인이 잡히면 뺀다 (2026-07-30) */}
            {ms && (
              <p className="note">
                <b>
                  총 {(ms.total / 1000).toFixed(1)}초 · 장당 {Math.round(ms.total / (n - failed))}ms
                </b>{' '}
                ({ms.lanes}장씩 동시)
                <br />
                장당 평균 — 읽기 {Math.round(ms.read)}ms · 펼치기 {Math.round(ms.decode)}ms · 굽기{' '}
                {Math.round(ms.encode)}ms · 저장 {Math.round(ms.write)}ms
                <br />
                원본 {ms.px} · 저장 {state.cfg.saveRes}
              </p>
            )}

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
              <button
                onClick={() =>
                  dispatch({ type: 'snack', snack: { msg: '.zip 공유 (단계 5)' } })
                }
              >
                📦 .zip 공유
              </button>
              <button
                onClick={() =>
                  dispatch({ type: 'snack', snack: { msg: 'JPEG 공유 (단계 5)' } })
                }
              >
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
