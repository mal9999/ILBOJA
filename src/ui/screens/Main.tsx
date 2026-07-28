/**
 * S1 메인 — 동산형 단일화면. 표 + 아이콘바 + 아레나 3단 (03 §1 · §4 S1).
 * 헤더도 하단바도 없다. 남는 높이는 전부 사진에 준다.
 */

import { useState } from 'react'
import EditTable from '../components/EditTable'
import Stage from '../components/Stage'
import { useStore } from '../state/store'
import { usePorts } from '../state/ports'
import type { PhotoSource } from '../../platform/ports'

type Side = 'left' | 'right' | null

export default function Main() {
  const { state, dispatch } = useStore()
  const ports = usePorts()
  const [side, setSide] = useState<Side>(null)

  const shoot = async (source: PhotoSource) => {
    setSide(null)
    // 카메라가 뜬 사이 안드로이드가 앱을 죽일 수 있다 → 되돌아올 값을 먼저 남긴다 (03 §2.3)
    ports.storage.set('slate', state.slate)
    ports.storage.set('cur', state.cur)

    const image = await ports.camera.capture(source)
    if (!image) return // 사용자가 취소
    dispatch({
      type: 'addPhoto',
      image,
      note: source === 'gallery' ? '갤러리에서 1장 불러옴' : undefined,
    })
  }

  const say = (msg: string) => {
    setSide(null)
    dispatch({ type: 'snack', snack: { msg } })
  }

  return (
    <>
      <EditTable />

      <div className="icons">
        <button className="cam" onClick={() => shoot('camera')}>
          <span className="ic">📷</span>촬영
        </button>
        <button onClick={() => shoot('system')}>
          <span className="ic">🔄</span>카메라전환
        </button>
        <button onClick={() => dispatch({ type: 'go', screen: 'export' })}>
          <span className="ic">📤</span>내보내기
        </button>
        <button onClick={() => dispatch({ type: 'go', screen: 'settings' })}>
          <span className="ic">⚙</span>설정
        </button>
        <button onClick={() => dispatch({ type: 'go', screen: 'list' })}>
          <span className="ic">≡</span>목록
        </button>
      </div>

      <div className="arena">
        <button className="sidetab" onClick={() => setSide('left')}>
          보드판서식
        </button>
        <Stage />
        <button className="sidetab" onClick={() => setSide('right')}>
          공유
        </button>

        {side && <button className="scrim" aria-label="닫기" onClick={() => setSide(null)} />}

        {side === 'left' && (
          <div className="panel left">
            <h4>보드판서식</h4>
            <button onClick={() => shoot('gallery')}>
              🖼 불러오기<span className="ph">폰 사진</span>
            </button>
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
          </div>
        )}

        {side === 'right' && (
          <div className="panel right">
            <h4>공유</h4>
            <button
              onClick={() => {
                setSide(null)
                dispatch({ type: 'go', screen: 'export' })
              }}
            >
              🔗 공유하기<span className="ph">파일로</span>
            </button>
          </div>
        )}
      </div>
    </>
  )
}
