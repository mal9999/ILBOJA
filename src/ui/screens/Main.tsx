/**
 * S1 메인 — 동산형 단일화면. 표 + 아이콘바 + 아레나 3단 (03 §1 · §4 S1).
 * 헤더도 하단바도 없다. 남는 높이는 전부 사진에 준다.
 *
 * 주 동선은 **표를 고치고 셔터, 반복**이다(2026-07-29 확인). 사진은 확인용이라
 * 아레나가 작아도 되고, 크게 보며 찾는 건 프리뷰를 탭해 들어가는 별도 화면이 맡는다.
 */

import { useEffect, useRef, useState } from 'react'
import EditTable from '../components/EditTable'
import Stage from '../components/Stage'
import Viewer from '../components/Viewer'
import { useStore } from '../state/store'
import { usePorts } from '../state/ports'
import { primeImage } from '../state/images'
import { PREVIEW_PARENT } from '../../platform/preview'
import type { CapturedImage, PhotoSource } from '../../platform/ports'

type Side = 'left' | 'right' | null

/**
 * 설정의 「카메라 해상도」(`'4080 × 3060 (4:3)'`)를 숫자로.
 * 못 읽으면 `undefined` — 그때는 기기 기본으로 찍는다(막지 않는다).
 */
function camSize(label: string): { width: number; height: number } | undefined {
  const m = /(\d+)\s*×\s*(\d+)/.exec(label)
  return m ? { width: Number(m[1]), height: Number(m[2]) } : undefined
}

export default function Main() {
  const { state, dispatch } = useStore()
  const ports = usePorts()
  const [side, setSide] = useState<Side>(null)
  const [camOn, setCamOn] = useState(false)
  /** 큰 이미지 전체화면. 화면 전환이 아니라 메인 위에 덮는 것이라 여기 지역 상태로 둔다 */
  const [viewer, setViewer] = useState(false)
  const arena = useRef<HTMLDivElement>(null)
  /** 사진 id 의 일련번호. 여러 장이 같은 밀리초에 들어와도 안 겹치게 한다 */
  const seq = useRef(0)

  /**
   * 사진 한 장을 앱에 들인다. 촬영이든 불러오기든 여기부터는 같다.
   *
   * id 는 **한 번에 여러 장이 들어와도 안 겹쳐야** 한다. 예전엔 `찍은시각_현재장수` 였는데,
   * 여러 장을 연달아 넣으면 시각이 같고 장수는 아직 안 늘어나 **전부 같은 id** 가 된다
   * (뒤 사진이 앞 사진의 파일을 덮어쓴다). 그래서 세션 안에서 증가하는 번호를 쓴다.
   */
  const addPhoto = async (image: CapturedImage) => {
    // 사진 바이트는 상태에 넣지 않는다 — 곧장 저장소로 보내고 메타만 dispatch (02 §4).
    // 방금 펼친 것은 캐시에 얹어 둔다. 바로 다시 읽어 펼치는 건 낭비다
    const id = `p${Date.now()}_${seq.current++}`
    const paths = await ports.db.putBlobs(id, { original: image.blob, thumb: image.thumb })
    primeImage(id, 'original', image.source)
    dispatch({
      type: 'addPhoto',
      id,
      width: image.width,
      height: image.height,
      sha256: image.sha256,
      paths,
    })
  }

  /** 앱 밖으로 나가는 경로 — 갤러리 불러오기(여러 장), 시스템 카메라 */
  const shoot = async (source: PhotoSource) => {
    setSide(null)
    // 앱이 뜬 사이 안드로이드가 우리를 죽일 수 있다 → 되돌아올 값을 먼저 남긴다 (03 §2.3)
    ports.storage.set('slate', state.slate)
    ports.storage.set('cur', state.cur)

    let picked
    try {
      picked = await ports.camera.capture(source)
    } catch (e) {
      // 권한 거부 같은 진짜 실패. 아무 일도 안 일어난 것처럼 보이면 현장에서 원인을 못 찾는다
      const why = e instanceof Error ? e.message : String(e)
      dispatch({ type: 'snack', snack: { msg: `카메라를 열지 못했습니다 — ${why}` } })
      return
    }
    if (!picked.length) return // 사용자가 취소

    // **한 장씩 열어서 바로 저장소로 보낸다.** 골라 온 걸 한꺼번에 펼치면 20장에 220MB (02 §4)
    let done = 0
    for (const open of picked) {
      if (picked.length > 1) {
        // 여러 장이면 몇 초 걸린다. 멈춘 것처럼 보이면 안 된다
        dispatch({ type: 'snack', snack: { msg: `불러오는 중… ${done + 1} / ${picked.length}장` } })
      }
      try {
        await addPhoto(await open())
        done++
      } catch {
        /* 한 장이 깨져도 나머지는 들인다. 몇 장 들어왔는지는 아래에서 말해 준다 */
      }
    }

    if (source === 'gallery' || picked.length > 1) {
      const lost = picked.length - done
      dispatch({
        type: 'snack',
        snack: { msg: lost ? `${done}장 불러옴 · ${lost}장 실패` : `${done}장 불러옴` },
      })
    }
  }

  const startCam = () => {
    setSide(null)
    setCamOn(true)
  }
  const stopCam = () => setCamOn(false)

  /** 셔터 — 앱을 벗어나지 않는다. 찍고 나서도 프리뷰가 그대로라 바로 다음 장을 찍을 수 있다 */
  const shutter = async () => {
    try {
      const image = await ports.preview.shoot(camSize(state.cfg.camRes))
      if (!image) {
        // 조용히 넘어가면 현장에서 "눌렀는데 아무 일도 안 난다"가 된다. 반드시 말한다
        dispatch({ type: 'snack', snack: { msg: '촬영 결과가 비어 있습니다 — 다시 눌러 주세요' } })
        return
      }
      await addPhoto(image)
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e)
      dispatch({ type: 'snack', snack: { msg: `촬영 실패 — ${why}` } })
    }
  }

  /**
   * 프리뷰 수명은 여기 한 곳에서만 관리한다.
   * 프리뷰가 아레나를 **덮으므로**, 시트나 사이드패널이 열릴 때는 잠시 꺼야 표를 고칠 수 있다.
   */
  // 사용법이 열려 있을 때도 꺼야 한다 — 네이티브 프리뷰는 우리 화면 위에 그려져서 글을 덮는다
  const covered = state.sheet !== null || side !== null || state.help
  const wantCam = camOn && !covered

  useEffect(() => {
    let alive = true
    const run = async () => {
      if (!wantCam) {
        await ports.preview.stop()
        return
      }
      const box = arena.current?.getBoundingClientRect()
      if (!box) return
      try {
        await ports.preview.start({
          x: box.left,
          y: box.top,
          width: box.width,
          height: box.height,
        })
      } catch (e) {
        if (!alive) return
        const why = e instanceof Error ? e.message : String(e)
        dispatch({ type: 'snack', snack: { msg: `카메라를 열지 못했습니다 — ${why}` } })
        setCamOn(false)
      }
    }
    void run()
    return () => {
      alive = false
    }
  }, [wantCam, ports, dispatch])

  // 네이티브 뷰라 화면을 떠나도 저절로 사라지지 않는다. 반드시 꺼야 한다
  useEffect(() => {
    return () => {
      void ports.preview.stop()
    }
  }, [ports])

  const say = (msg: string) => {
    setSide(null)
    dispatch({ type: 'snack', snack: { msg } })
  }

  const go = (screen: 'export' | 'settings' | 'list') => {
    void stopCam()
    dispatch({ type: 'go', screen })
  }

  return (
    <>
      {/* 표가 지금 어느 쪽 값을 보여주는지. 답한 결과가 눈에 보여야 한다 */}
      {state.photos.length > 0 && (
        <div className={`modebar ${state.mode}`}>
          <span>
            {state.mode === 'edit'
              ? `✏ ${state.cur + 1}번 사진 수정 중`
              : '📷 새로 찍을 사진용 값'}
          </span>
        </div>
      )}

      <EditTable />

      <div className="icons">
        {camOn ? (
          <>
            <button className="cam" onClick={shutter}>
              <span className="ic">📸</span>셔터
            </button>
            <button onClick={stopCam}>
              <span className="ic">✕</span>카메라끄기
            </button>
          </>
        ) : (
          <>
            <button className="cam" onClick={startCam}>
              <span className="ic">📷</span>촬영
            </button>
            {/*
             * 여기 있던 `카메라전환`(폰 카메라 앱)을 뺐다 — **찍은 사진이 사라지는 경로**였다.
             * 인텐트에 `EXTRA_OUTPUT` 을 주므로 폰 카메라 앱은 우리 파일에만 쓰고 갤러리에 안 넣는데,
             * 이 기종은 결과가 앱으로 안 돌아온다 → 앱에도 갤러리에도 안 남는다 (2026-07-30).
             * 그 자리에 좌패널에 숨어 있던 `불러오기` 를 올렸다.
             */}
            <button onClick={() => shoot('gallery')}>
              <span className="ic">🖼</span>불러오기
            </button>
          </>
        )}
        <button onClick={() => go('export')}>
          <span className="ic">📤</span>내보내기
        </button>
        <button onClick={() => go('settings')}>
          <span className="ic">⚙</span>설정
        </button>
        <button onClick={() => go('list')}>
          <span className="ic">≡</span>목록
        </button>
      </div>

      <div className="arena" ref={arena}>
        {/* 프리뷰가 들어갈 자리. 켜기 전에 이미 DOM 에 있어야 한다(웹 구현이 여기에 video 를 넣는다) */}
        <div id={PREVIEW_PARENT} className="preview" />

        <button className="sidetab l" onClick={() => setSide('left')}>
          보드판서식
        </button>
        {!camOn && !viewer && <Stage onOpen={() => setViewer(true)} />}
        <button className="sidetab r" onClick={() => setSide('right')}>
          공유
        </button>

        {side && <button className="scrim" aria-label="닫기" onClick={() => setSide(null)} />}

        {side === 'left' && (
          <div className="panel left">
            <h4>보드판서식</h4>
            {/* 불러오기는 아이콘바로 올라갔다(카메라전환 자리). 여기 또 두지 않는다 */}
            <button onClick={() => say('저장됨 (수정하면 자동 저장 — 따로 누를 필요 없어요)')}>
              💾 저장하기<span className="ph">자동저장됨</span>
            </button>
            <button
              onClick={() => {
                setSide(null)
                dispatch({ type: 'remove' })
              }}
            >
              🗑 삭제하기<span className="ph">되돌리기 가능</span>
            </button>
            {/* 스낵바 8초가 지나도 여기 남는다 — 8초 안에 판단하라는 건 고령 사용자에게 무리다 (03 §2.7) */}
            {state.bulkUndo && (
              <button
                onClick={() => {
                  setSide(null)
                  dispatch({ type: 'undoBulk' })
                }}
              >
                ↩ 최근 변경 되돌리기
                <span className="ph">
                  「{state.bulkUndo.label.replace(/\s+/g, '')}」 {state.bulkUndo.before.length}장
                </span>
              </button>
            )}
            <button onClick={() => say('서식(표 항목·폴더규칙·표 모양)을 .json 으로 내보내 전달')}>
              📨 서식 전송<span className="ph">.json 내보내기</span>
            </button>
            <button
              onClick={() =>
                say('받은 서식 .json 열기 — 미리보기 후 확인하면 현재 서식을 덮어씀')
              }
            >
              📥 서식 수신<span className="ph">받은 서식 열기</span>
            </button>
            {/* 작업 중에도 열 수 있어야 한다. 홈까지 되돌아가게 하면 아무도 안 본다 */}
            <button
              onClick={() => {
                setSide(null)
                dispatch({ type: 'help', on: true })
              }}
            >
              ❓ 사용법<span className="ph">처음이신가요</span>
            </button>
          </div>
        )}

        {side === 'right' && (
          <div className="panel right">
            <h4>공유</h4>
            <button
              onClick={() => {
                setSide(null)
                go('export')
              }}
            >
              🔗 공유하기<span className="ph">파일로</span>
            </button>
          </div>
        )}
      </div>

      {viewer && <Viewer onClose={() => setViewer(false)} />}
    </>
  )
}
