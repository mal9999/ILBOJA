/**
 * 큰 이미지 전체화면 — **찾기·수정 동선**의 핵심 (02 §4 · 2026-07-29 정정).
 *
 * 주 동선(표 고치고 촬영, 반복)에서는 메인의 작은 프리뷰로 충분하다. 여기는
 * 미리 찍어 둔 것 중에서 고칠 한 장을 **찾을 때** 쓴다 — 폰 갤러리가 작게 보여줘서
 * 못 하는 일을 우리가 대신하는 자리라, 화면을 통째로 쓴다.
 *
 * 선택은 따로 없다. 스와이프로 넘긴 사진이 곧 `cur` 이라 닫으면 메인이 그 사진을 들고 있다.
 */

import Stage from './Stage'
import { useStore } from '../state/store'

export default function Viewer({ onClose }: { onClose: () => void }) {
  const { dispatch } = useStore()

  /** 이름 그대로 **수정 스위치를 켜고** 닫는다 — 찾아 놓고 또 버튼을 누르게 하면 안 된다 */
  const edit = () => {
    dispatch({ type: 'mode', mode: 'edit' })
    onClose()
  }

  return (
    <div className="viewer">
      <Stage />
      {/* 그냥 닫기 = 촬영용 그대로. 아래 버튼 = 이 사진을 고치러 간다 */}
      <button className="vclose" onClick={onClose}>
        ✕ 닫기
      </button>
      {/*
       * 회전 — 자동 보정이 어긋났을 때 사람이 고치는 길.
       * 이 기종 카메라가 방향과 무관하게 EXIF 6 을 붙여서 가로 촬영이 눕는다(2026-08-03).
       * 원본은 안 건드리고 표시 각도만 돈다. 표도 같이 바로 선다.
       */}
      <button className="vturn" onClick={() => dispatch({ type: 'rotate' })}>
        ↻ 회전
      </button>
      <button className="vpick" onClick={edit}>
        ✏ 이 사진 고치기
      </button>
    </div>
  )
}
