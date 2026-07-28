import { webPorts } from './platform/web'
import AppShell from './ui/AppShell'
import { PortsProvider } from './ui/state/ports'
import { StoreProvider } from './ui/state/store'
import './ui/styles.css'

/** 브라우저에서는 web 어댑터를 꽂는다. APK 는 단계 4~5에서 native 로 교체 */
export default function App() {
  return (
    <PortsProvider ports={webPorts}>
      <StoreProvider>
        <AppShell />
      </StoreProvider>
    </PortsProvider>
  )
}
