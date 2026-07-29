import { Capacitor } from '@capacitor/core'
import { nativePorts } from './platform/native'
import { webPorts } from './platform/web'
import AppShell from './ui/AppShell'
import { PortsProvider } from './ui/state/ports'
import { StoreProvider } from './ui/state/store'
import './ui/styles.css'

/** APK 안이면 native, PC 브라우저면 web. `ui/` 는 어느 쪽인지 알지 못한다 (02 §2) */
const ports = Capacitor.isNativePlatform() ? nativePorts : webPorts

export default function App() {
  return (
    <PortsProvider ports={ports}>
      <StoreProvider>
        <AppShell />
      </StoreProvider>
    </PortsProvider>
  )
}
