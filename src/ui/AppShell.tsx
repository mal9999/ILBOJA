/**
 * 화면 전환 + 오버레이. 라우터 라이브러리를 쓰지 않는다 —
 * 화면이 6개뿐이고 뒤로가기가 화면마다 정해져 있어 상태 하나로 충분하다.
 */

import { useEffect } from 'react'
import { App } from '@capacitor/app'
import Sheets from './components/Sheets'
import Snack from './components/Snack'
import Camera from './screens/Camera'
import Export from './screens/Export'
import FormEdit from './screens/FormEdit'
import Help from './screens/Help'
import Home from './screens/Home'
import List from './screens/List'
import Main from './screens/Main'
import Settings from './screens/Settings'
import { useBackHandler, runBack } from './state/back'
import { useStore } from './state/store'

export default function AppShell() {
  const { state, dispatch } = useStore()

  // 큰글씨 모드는 :root 변수 하나로 전 화면에 적용된다 (00.요구사항 §7)
  useEffect(() => {
    document.documentElement.dataset.big = state.bigText ? '1' : '0'
  }, [state.bigText])

  /**
   * 촬영 화면에서는 **우리 배경을 전부 비운다.**
   *
   * 네이티브 프리뷰는 WebView 뒤에 그려진다(`preview.ts` `toBack:true`). 플러그인이 WebView 를
   * 투명하게 만들어 주지만, 그 위에 `body`·`.phone` 이 불투명한 색을 다시 칠하면 카메라가 안 비친다 —
   * 2026-07-29 에 "기기가 하얗게 나온다"고 본 것이 이것이었다. 배경을 지우는 건 :root 한 곳에서만 한다.
   */
  useEffect(() => {
    document.documentElement.dataset.cam = state.screen === 'camera' ? '1' : '0'
  }, [state.screen])

  /**
   * 뒤로가기 — **바닥 처리기.** 덮개(시트·뷰어 등)를 띄운 쪽이 먼저 가져가고,
   * 아무도 안 받으면 여기까지 내려온다 (`state/back.ts`).
   *
   * 홈이 마지막 칸이다. 홈에서 한 번 더 누르면 그때 앱이 꺼진다 — 작업 화면에서 바로
   * 꺼지던 것이 문제였다(2026-08-03). 사진은 이미 저장돼 있지만 **꺼졌다는 사실 자체가 놀랍다.**
   */
  useBackHandler(true, () => {
    if (state.help) {
      dispatch({ type: 'help', on: false })
      return true
    }
    if (state.sheet) {
      dispatch({ type: 'sheet', sheet: null })
      return true
    }
    if (state.screen === 'home') return false // 여기서만 앱이 꺼진다
    dispatch({ type: 'go', screen: state.screen === 'main' ? 'home' : 'main' })
    return true
  })

  useEffect(() => {
    const p = App.addListener('backButton', () => {
      if (!runBack()) void App.exitApp()
    })
    return () => {
      void p.then((h) => h.remove())
    }
  }, [])

  return (
    <div className="phone">
      {state.screen === 'home' && <Home />}
      {state.screen === 'main' && <Main />}
      {state.screen === 'list' && <List />}
      {state.screen === 'export' && <Export />}
      {state.screen === 'settings' && <Settings />}
      {state.screen === 'form' && <FormEdit />}
      {state.screen === 'camera' && <Camera />}

      {/* 화면이 아니라 덮개다 — 닫으면 하던 자리 그대로 */}
      {state.help && <Help />}

      <Sheets />
      <Snack />
    </div>
  )
}
