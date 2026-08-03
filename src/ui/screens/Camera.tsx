/**
 * S6 촬영 — **전체화면 카메라.** 동산 흐름을 그대로 따른다 (사용자 확인, 2026-08-03).
 *
 * 1. 카메라가 화면을 통째로 쓴다 (아레나 안 작은 창이 아니다)
 * 2. **폰을 돌리면 가로/세로가 따라간다** — 잠그지 않는다
 * 3. **표가 들어갈 자리를 프리뷰 위에서 보고 순차로 옮긴다**
 * 4. 셔터를 누르면 **카메라가 닫히고 메인으로 나온다** — 무조건 한 장씩
 *
 * 4번이 이전 설계(프리뷰를 유지한 채 연속 촬영)를 뒤집은 것이다. 현장 작업자에게 확인한
 * 요구라 그대로 따른다 — 한 장 찍을 때마다 결과를 보고 다음으로 넘어가는 흐름이다.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { rowsForRender, type Rotate } from '../../core/models'
import type { StampPos } from '../../core/renderStamp'
import { renderStamp } from '../../core/renderStamp'
import { orientation } from '../../platform/orientation'
import { PREVIEW_PARENT } from '../../platform/preview'
import { reason, type FlashMode, type PreviewRect } from '../../platform/ports'
import { previewFields, useStore } from '../state/store'
import { usePorts } from '../state/ports'
import { primeImage } from '../state/images'

/**
 * 자리를 옮기는 순서 — **왼아래 → 오른아래 → 오른위 → 왼위.**
 * 한 방향으로만 돌아야 몇 번 누르면 원하는 자리가 오는지 몸이 기억한다.
 */
const RING: StampPos[] = ['bl', 'br', 'tr', 'tl']
const POS_LABEL: Record<StampPos, string> = {
  bl: '왼쪽 아래',
  br: '오른쪽 아래',
  tr: '오른쪽 위',
  tl: '왼쪽 위',
}

const FLASH_LABEL: Record<FlashMode, string> = {
  off: '끔',
  on: '켬',
  torch: '손전등',
}

/**
 * 설정의 「카메라 해상도」(`'4080 × 3060 (4:3)'`)를 숫자로.
 * 못 읽으면 `undefined` — 그때는 기기 기본으로 찍는다(막지 않는다).
 *
 * **가로 그대로 넘긴다.** 폰을 세워도 마찬가지다 — 플러그인은 이 값을 센서가 지원하는
 * 촬영 크기 목록에서 고르는 데 쓰는데(`getOptimalPictureSize`), 그 목록은 언제나 가로다.
 * 세로로 뒤집어 넘기면 맞는 크기를 못 찾는다. 회전은 플러그인이 픽셀에 구워서 준다.
 */
function camSize(label: string): { width: number; height: number } | undefined {
  const m = /(\d+)\s*×\s*(\d+)/.exec(label)
  return m ? { width: Number(m[1]), height: Number(m[2]) } : undefined
}

/**
 * 조작바의 두께. **`styles.css` 의 `.cam-bar` 와 반드시 같아야 한다** —
 * 세로에서는 `height`, 가로에서는 `width` 로 쓰인다.
 */
const BAR = 120

/**
 * 사진 비율에 맞춘 프리뷰 자리. **화면을 꽉 채우지 않는다.**
 *
 * 두 가지를 동시에 지킨다.
 *
 * 1. **비율** — 폰 화면은 20:9 인데 사진은 4:3 이다. 꽉 채우면 프리뷰가 잘려서
 *    **여기서 본 표 자리와 실제로 찍힌 사진의 표 자리가 어긋난다.** 표를 보며 자리를
 *    고르는 이 화면의 뜻이 사라지므로, 비율을 지켜 가운데 놓고 남는 데는 검게 둔다.
 * 2. **조작바를 피한다** — 바는 세로에서 아래, 가로에서 오른쪽에 붙는다. 그 자리를 빼지 않으면
 *    **가로에서 바가 프리뷰 아래쪽을 덮어** 「왼쪽 아래」·「오른쪽 아래」 표가 안 보인다.
 *    자리를 고르러 온 화면에서 그 자리가 가려지면 안 된다.
 *
 * ⚠️ **검은 띠의 크기는 여기서 못 줄인다** (2026-08-03 실측·계산). 384×832 화면에서
 * 4:3 은 512×384 가 상한이라 200px 이 남고, **짧은 변이 상한이라 프리뷰를 더 키울 수가 없다.**
 * 남는 자리를 바에게 주는 안은 «바만 320 으로 넓어지고 어두운 넓이는 그대로»라 폐기했다.
 * 실제로 보이는 사진을 키우는 길은 **16:9 로 찍는 것 하나뿐**이다(설정 「카메라 해상도」).
 *
 * @param ar 사진의 긴변/짧은변 (4:3 이면 1.333, 16:9 면 1.778)
 */
function frameFor(vw: number, vh: number, ar: number): PreviewRect {
  const portrait = vh >= vw
  // 바를 뺀 나머지. 프리뷰는 이 안에서만 논다
  const aw = portrait ? vw : vw - BAR
  const ah = portrait ? vh - BAR : vh
  const width = Math.round(portrait ? Math.min(aw, ah / ar) : Math.min(aw, ah * ar))
  const height = Math.round(portrait ? width * ar : width / ar)
  return {
    x: Math.round((aw - width) / 2),
    y: Math.round((ah - height) / 2),
    width,
    height,
  }
}

/**
 * 갤러리에 남길 원본 이름 — **촬영 시각 기준.**
 *
 * 표 값(단지·동호수)으로 짓지 않는다. 값은 찍은 뒤에도 고칠 수 있어서 이름과 내용이 갈린다.
 * 내보내기 파일명은 그 시점 값으로 다시 지으므로(`buildPath`) 여기는 «언제 찍었나»만 남기면 된다.
 */
function galleryName(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `일보자_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.jpg`
}

/**
 * 눕혀 찍은 사진을 바로 세울 **보정 각도**를 정한다. **EXIF 는 안 본다.**
 *
 * 이 기종 카메라는 폰을 어떻게 들었든 EXIF 방향을 늘 `6`(90° 돌려라)으로 붙인다
 * (실기기 원본 4장 분석, 2026-08-03 — 전부 `1920×1440` + `EXIF 6`).
 * 세로로 찍으면 그게 맞아떨어지지만 **가로로 찍어도 똑같이 90° 를 돌려서 눕는다.**
 *
 * 그래서 «셔터를 누른 순간 화면이 가로였나» 와 «펼쳐 보니 가로인가» 를 맞대 본다.
 * 두 값이 어긋나면 90° 틀어진 것이고, **어느 쪽으로 되돌릴지는 화면 각도가 알려 준다.**
 *
 * @param angle `screen.orientation.angle` — 자연방향 대비 화면이 돌아간 각도(0·90·180·270)
 */
function fixRotation(
  shotLandscape: boolean,
  angle: number,
  width: number,
  height: number,
): Rotate {
  // 펼친 결과가 기대한 방향과 같으면 손댈 것이 없다
  if (shotLandscape === width > height) return 0
  // 90° 로 돌려 들었으면 반대로 90° 되돌린다(=270). 270° 로 들었으면 90°
  return angle === 270 ? 90 : 270
}

const same = (a: PreviewRect, b: PreviewRect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height

export default function Camera() {
  const { state, dispatch } = useStore()
  const ports = usePorts()
  /** 화면 전체를 덮는 껍데기. **크기를 재는 기준**이라 ref 가 필요하다(아래 회전 감지) */
  const root = useRef<HTMLDivElement>(null)
  const stamp = useRef<HTMLCanvasElement>(null)
  /** 셔터를 눌러 저장하는 중. 두 번 눌려 같은 장이 두 번 들어가면 안 된다 */
  const [busy, setBusy] = useState(false)

  const [flash, setFlashState] = useState<FlashMode>('off')
  /** 이 기기가 되는 모드. 프리뷰를 켜 봐야 알 수 있다 — 비어 있으면 버튼도 없다 */
  const [flashModes, setFlashModes] = useState<FlashMode[]>([])
  /**
   * 프리뷰를 다시 켤 때 되심기 위해 최신 값을 들고 있는다.
   * 상태를 그 `useEffect` 의 의존성에 넣으면 **플래시를 바꿀 때마다 카메라가 꺼졌다 켜진다.**
   */
  const flashRef = useRef(flash)
  const applyFlash = (m: FlashMode) => {
    flashRef.current = m
    setFlashState(m)
  }

  const size = camSize(state.cfg.camRes)
  /** 사진 비율. 해상도를 못 읽으면 4:3 으로 본다 — 대부분의 기기 기본값이다 */
  const ar = size ? Math.max(size.width, size.height) / Math.min(size.width, size.height) : 4 / 3

  const [box, setBox] = useState<PreviewRect>(() =>
    frameFor(window.innerWidth, window.innerHeight, ar),
  )

  /**
   * 회전 감지 — **`window.resize` 를 믿으면 안 된다.**
   *
   * 안드로이드는 `configChanges` 에 orientation 이 있어 액티비티를 다시 만들지 않는데,
   * 이때 WebView 가 `resize` 를 안 쏘거나 늦게 쏜다(실기기 2026-08-03). 그러면
   * **네이티브 프리뷰만 저 혼자 돌고**(플러그인이 센서→디스플레이 매핑을 다시 잡는다)
   * 우리 표 오버레이는 세로 자리에 그대로 남는다 — "사진은 도는데 표만 안 돈다"가 이것이다.
   *
   * 그래서 이벤트가 아니라 **실제 레이아웃 크기를 관찰한다.** `.camera` 는 `position:fixed;inset:0`
   * 이라 그 크기가 곧 뷰포트다. 크기를 `contentRect` 에서 바로 읽는 것도 중요하다 —
   * `window.innerWidth` 는 이 시점에 아직 옛 값일 수 있다.
   */
  useEffect(() => {
    const el = root.current
    if (!el) return
    // 회전 애니메이션 도중 여러 번 온다. 끝난 뒤 한 번만 잡는다
    let timer: ReturnType<typeof setTimeout>
    const measure = (w: number, h: number) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const next = frameFor(w, h, ar)
        // 값이 같으면 그대로 둔다 — 새 객체를 넣으면 프리뷰를 공연히 껐다 켠다
        setBox((prev) => (same(prev, next) ? prev : next))
      }, 150)
    }
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      if (width && height) measure(width, height)
    })
    ro.observe(el)
    // 크기가 같은데 방향만 바뀌는 경우(정사각 화면 등)를 위한 보조 신호
    const onTurn = () => measure(window.innerWidth, window.innerHeight)
    window.addEventListener('orientationchange', onTurn)
    return () => {
      clearTimeout(timer)
      ro.disconnect()
      window.removeEventListener('orientationchange', onTurn)
    }
  }, [ar])

  /** 프리뷰 수명. 이 화면에 있는 동안만 켜져 있고, 나가면 반드시 꺼진다(네이티브 뷰다) */
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        await ports.preview.start(box)
      } catch (e) {
        if (!alive) return
        const why = reason(e)
        dispatch({ type: 'snack', snack: { msg: `카메라를 열지 못했습니다 — ${why}` } })
        dispatch({ type: 'go', screen: 'main' })
        return
      }
      /**
       * 플래시는 **프리뷰가 켜진 뒤에** 다룬다 — 되는 모드도 카메라에 물어야 알고,
       * 폰을 돌리면 여기를 다시 지나는데 그때 플래시는 **기기 기본(꺼짐)으로 돌아가 있다.**
       * 켜 뒀던 것을 되심지 않으면 눕히는 순간 불이 조용히 꺼진다.
       */
      const modes = await ports.preview.flashModes()
      if (!alive) return
      setFlashModes(modes)
      if (flashRef.current === 'off') return
      try {
        await ports.preview.setFlash(flashRef.current)
      } catch {
        if (!alive) return
        applyFlash('off')
        dispatch({ type: 'snack', snack: { msg: '플래시가 꺼졌습니다 — 다시 켜 주세요' } })
      }
    })()
    return () => {
      alive = false
    }
  }, [box, ports, dispatch])

  /**
   * **이 화면만 폰을 따라 돈다.** 앱 나머지는 세로 고정이다(`AndroidManifest`, `platform/orientation`).
   * 사진은 눕혀 찍으므로 여기서 잠겨 있으면 가로 사진이 아예 안 나온다.
   *
   * ⚠️ **끄기와 세로 잠금은 순서가 있다.** 플러그인의 `stop` 은 «켤 때의 방향 요청» 을
   * UI 스레드에서 되돌려 놓는데(`CameraPreview.java:124`), 그 값은 우리가 `followSensor()` 를
   * 부른 **뒤에** 잡힌 SENSOR 다. 둘을 나란히 쏘면 그 복원이 우리 잠금보다 늦게 도착해서
   * **카메라를 다녀오면 앱 전체가 폰을 따라 돈다**(실기기 확인 2026-08-03 — 촬영 뒤 메인이 가로였다).
   * 그래서 `stop` 이 끝난 것을 보고 나서 잠근다.
   */
  useEffect(() => {
    void orientation.followSensor()
    return () => {
      void ports.preview.stop().finally(() => orientation.lockPortrait())
    }
  }, [ports])

  /** 지금 찍으면 표가 이렇게 나온다 — 값도 자리도 실제 결과와 같아야 의미가 있다 */
  const rows = useMemo(
    () => rowsForRender(state.form, previewFields(state)),
    // previewFields 는 form·slate·mode·photos 를 읽는다. 표에 보이는 값이 바뀌면 다시 그린다
    [state],
  )

  useEffect(() => {
    const cv = stamp.current
    const c = cv?.getContext('2d')
    if (!cv || !c) return
    const dpr = window.devicePixelRatio || 1
    cv.width = Math.round(box.width * dpr)
    cv.height = Math.round(box.height * dpr)

    /**
     * 촬영 화면에는 **표를 그리지 않고 «자리»만 표시한다** (사용자 결정 2026-08-03).
     *
     * 여기서 필요한 건 "표가 어디에 들어가는가" 하나뿐이다. 값까지 읽을 표는 찍고 나서
     * 메인에서 보면 된다. 표를 그대로 그리면 프리뷰를 가리기만 하고, 폰을 눕혔을 때
     * 방향까지 맞춰 줘야 하는 짐이 생긴다 — 자리만 보여 주면 그 문제가 통째로 사라진다.
     *
     * 치수는 **실제 표를 한 번 그려서** 얻는다. 따로 계산하면 `renderStamp` 가 바뀔 때
     * 조용히 어긋나서, 미리보기가 거짓말을 하게 된다.
     */
    const { x, y, boxW, boxH, rows: n } = renderStamp(c, cv.width, cv.height, rows, state.style)
    c.clearRect(0, 0, cv.width, cv.height)
    if (!n) return

    // 햇빛 아래서도 자리가 보여야 한다 — 흐린 채움 + 흰 테두리에 검은 그림자를 겹친다
    const lw = Math.max(2, Math.round(cv.width * 0.005))
    c.fillStyle = 'rgba(255,255,255,0.28)'
    c.fillRect(x, y, boxW, boxH)
    c.lineWidth = lw
    c.strokeStyle = 'rgba(0,0,0,0.55)'
    c.strokeRect(x - lw, y - lw, boxW + lw * 2, boxH + lw * 2)
    c.strokeStyle = '#fff'
    c.strokeRect(x, y, boxW, boxH)
  }, [box, rows, state.style])

  /**
   * 표 자리를 다음 칸으로. **설정의 「다음 촬영 기본값」을 바꾸는 것**이라 다음에 열어도 그대로다.
   * 이미 찍은 사진은 자기 자리를 들고 있어서(`Photo.stampPos`) 따라 움직이지 않는다.
   */
  const nextPos = () => {
    const i = RING.indexOf(state.style.pos)
    dispatch({ type: 'setStyle', patch: { pos: RING[(i + 1) % RING.length] } })
  }

  /**
   * 끔 → 켬 → 손전등 → 끔. **기기가 안 되는 모드는 목록에 없으므로 저절로 건너뛴다.**
   * 카메라가 받아들인 뒤에만 화면 표시를 바꾼다 — 실패했는데 「켬」이라고 적혀 있으면 안 된다.
   */
  const cycleFlash = async () => {
    const next = flashModes[(flashModes.indexOf(flash) + 1) % flashModes.length]
    try {
      await ports.preview.setFlash(next)
      applyFlash(next)
    } catch (e) {
      dispatch({ type: 'snack', snack: { msg: `플래시를 바꾸지 못했습니다 — ${reason(e)}` } })
    }
  }

  /** 셔터 — 찍고, 카메라를 닫고, 메인에서 결과를 본다 (한 장씩) */
  const shutter = async () => {
    if (busy) return
    setBusy(true)
    // **셔터를 누른 «순간»의 방향을 잡아 둔다.** 아래 await 사이에 폰이 움직일 수 있다
    const shotLandscape = window.innerWidth > window.innerHeight
    const shotAngle = screen.orientation?.angle ?? 0
    try {
      const image = await ports.preview.shoot(size)
      if (!image) {
        // 조용히 넘어가면 현장에서 "눌렀는데 아무 일도 안 난다"가 된다. 반드시 말한다
        dispatch({ type: 'snack', snack: { msg: '촬영 결과가 비어 있습니다 — 다시 눌러 주세요' } })
        return
      }
      // 사진 바이트는 상태에 넣지 않는다 — 곧장 저장소로 보내고 메타만 dispatch (02 §4)
      const id = `p${Date.now()}_0`
      const paths = await ports.db.putBlobs(id, { original: image.blob, thumb: image.thumb })
      primeImage(id, 'original', image.source)
      dispatch({
        type: 'addPhoto',
        id,
        width: image.width,
        height: image.height,
        sha256: image.sha256,
        paths,
        // 방금 눈으로 보고 고른 자리를 그 사진에 박는다
        stampPos: state.style.pos,
        rotate: fixRotation(shotLandscape, shotAngle, image.width, image.height),
      })
      // 카메라를 닫고 메인으로. `go` 가 프리뷰를 끄지는 않으므로 위 정리 효과가 끈다
      dispatch({ type: 'go', screen: 'main' })

      /**
       * 원본을 **폰 갤러리에도 한 벌** 남긴다 (2026-08-03 사용자 결정).
       *
       * 우리 원본은 앱 전용 영역에 있어 **앱을 지우면 같이 사라진다.** 갤러리에 있으면
       * 앱에 무슨 일이 생겨도 **「불러오기」로 다시 작업할 수 있다.**
       *
       * **화면을 넘긴 뒤에 한다** — 셔터에서 메인까지가 0.7초인데 여기에 4MB 쓰기를 얹으면
       * 그 값이 도로 무너진다. 실패해도 앱 안 사진은 멀쩡하므로 알리기만 하고 넘어간다.
       */
      void ports.share.saveOriginal(galleryName(), image.blob).catch((e) => {
        dispatch({ type: 'snack', snack: { msg: `갤러리 저장 실패 — ${reason(e)}` } })
      })
    } catch (e) {
      const why = reason(e)
      dispatch({ type: 'snack', snack: { msg: `촬영 실패 — ${why}` } })
    } finally {
      setBusy(false)
    }
  }

  const frame = { left: box.x, top: box.y, width: box.width, height: box.height }

  return (
    <div className="camera" ref={root}>
      {/* 프리뷰가 들어갈 자리. 켜기 전에 이미 DOM 에 있어야 한다(웹 구현이 여기에 video 를 넣는다) */}
      <div id={PREVIEW_PARENT} className="cam-preview" style={frame} />
      {/* 표는 프리뷰 **위에** 온다. 안드로이드에서는 `toBack:true` 라 이게 가능하다(preview.ts) */}
      <canvas ref={stamp} className="cam-stamp" style={frame} />

      <div className="cam-bar">
        {/* ⚠️ 클래스를 `pos` 로 쓰면 안 된다 — 스테이지의 「N/M장」 배지가 그 이름을 쓰고 있고,
            그 규칙은 `position:absolute` 에 **`pointer-events:none`** 까지 걸어서 버튼이 안 눌린다 */}
        <button className="seat" onClick={nextPos}>
          <span className="ic">⟳</span>표자리
          <span className="ph">{POS_LABEL[state.style.pos]}</span>
        </button>
        {/* 「끔」밖에 못 하는 기기(플래시 없음)·PC 브라우저에서는 버튼 자체를 안 낸다 */}
        {flashModes.some((m) => m !== 'off') && (
          <button className="flash" data-on={flash === 'off' ? undefined : '1'} onClick={cycleFlash}>
            <span className="ic">⚡</span>플래시
            <span className="ph">{FLASH_LABEL[flash]}</span>
          </button>
        )}
        <button className="shot" onClick={shutter} disabled={busy} aria-label="촬영">
          {busy ? '저장 중' : '●'}
        </button>
        <button className="close" onClick={() => dispatch({ type: 'go', screen: 'main' })}>
          <span className="ic">✕</span>닫기
        </button>
      </div>
    </div>
  )
}
