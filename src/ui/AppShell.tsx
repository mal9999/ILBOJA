/**
 * 화면 전환 + 오버레이. 라우터 라이브러리를 쓰지 않는다 —
 * 화면이 6개뿐이고 뒤로가기가 화면마다 정해져 있어 상태 하나로 충분하다.
 */

import { useEffect } from 'react'
import Sheets from './components/Sheets'
import Snack from './components/Snack'
import Export from './screens/Export'
import FormEdit from './screens/FormEdit'
import Home from './screens/Home'
import List from './screens/List'
import Main from './screens/Main'
import Settings from './screens/Settings'
import { useStore } from './state/store'

export default function AppShell() {
  const { state } = useStore()

  // 큰글씨 모드는 :root 변수 하나로 전 화면에 적용된다 (00.요구사항 §7)
  useEffect(() => {
    document.documentElement.dataset.big = state.bigText ? '1' : '0'
  }, [state.bigText])

  return (
    <div className="phone">
      {state.screen === 'home' && <Home />}
      {state.screen === 'main' && <Main />}
      {state.screen === 'list' && <List />}
      {state.screen === 'export' && <Export />}
      {state.screen === 'settings' && <Settings />}
      {state.screen === 'form' && <FormEdit />}

      <Sheets />
      <Snack />
    </div>
  )
}
