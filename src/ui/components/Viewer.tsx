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

export default function Viewer({ onClose }: { onClose: () => void }) {
  return (
    <div className="viewer">
      <Stage />
      <button className="vclose" onClick={onClose}>
        ✕ 닫기
      </button>
      <button className="vpick" onClick={onClose}>
        이 사진 편집하기
      </button>
    </div>
  )
}
