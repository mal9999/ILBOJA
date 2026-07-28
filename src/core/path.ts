/**
 * 폴더·파일명 생성 — 순수 함수.
 * 이관: 04.mock/기술검증-스파이크.html `sanitize` · `buildPath` (검증 통과분)
 *
 * 스파이크와 달라진 점: 항목을 **label 이 아니라 key 로 찾는다.**
 * label 은 설정에서 바꿀 수 있으므로("작 업 자"→"담당자"), label 로 경로를 조립하면
 * 이름만 바꿔도 폴더가 갈라진다. key 는 고정이다 (03 §3).
 */

import type { Fields } from './models'

/** Windows 예약 파일명. 이 이름 그대로는 파일을 못 만든다 */
const RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i

/**
 * 경로 한 조각으로 쓸 수 있게 문자열을 다듬는다.
 *
 * @param maxBytes 바이트 기준으로 자른다. 한글은 UTF-8 3바이트라 글자수로 자르면 한도를 넘는다
 */
export function sanitize(s: string | undefined | null, maxBytes = 80): string {
  let t = String(s ?? '')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_') // OS 금지문자
    .replace(/\s+/g, ' ') // 연속 공백·개행·탭 축약
    .trim()
    .replace(/[.\s]+$/, '') // 끝의 점·공백 (Windows가 잘라먹는다)

  if (!t) return ''
  if (RESERVED.test(t)) t += '_'

  const enc = new TextEncoder()
  if (enc.encode(t).length > maxBytes) {
    let cut = t
    while (enc.encode(cut).length > maxBytes) cut = cut.slice(0, -1)
    t = cut.trim()
  }
  return t
}

export interface PathConfig {
  /** 폴더로 쓸 항목 key (순서대로 중첩) */
  folderKeys: string[]
  /** 파일명으로 쓸 항목 key (`_` 로 이어붙임) */
  fileKeys: string[]
  /** 값이 비었을 때 쓸 폴더명 */
  fallbackFolder: string
  /** 파일명이 통째로 비었을 때 쓸 이름 */
  fallbackFile: string
}

/**
 * 표 값 → 저장 경로.
 *
 * @param seq 같은 이름이 겹칠 때를 위한 연번. 3자리 0채움
 */
export function buildPath(fields: Fields, cfg: PathConfig, seq: number): string {
  const pick = (key: string) => sanitize(fields[key])

  const folders = cfg.folderKeys.map((k) => pick(k) || cfg.fallbackFolder).filter(Boolean)
  const namePart = cfg.fileKeys.map(pick).filter(Boolean).join('_') || cfg.fallbackFile
  const seqStr = String(seq).padStart(3, '0')

  return `${[...folders, `${namePart}_${seqStr}.jpg`].join('/')}`
}
