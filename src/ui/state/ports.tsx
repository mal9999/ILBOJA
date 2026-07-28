/**
 * 플랫폼 주입 — `ui/` 는 구현을 import 하지 않고 이 컨텍스트로만 받는다.
 * 브라우저에서는 web 어댑터, APK 에서는 native 어댑터가 꽂힌다 (02 §2 불변 원칙).
 */

import { createContext, useContext, type ReactNode } from 'react'
import type { Ports } from '../../platform/ports'

const Ctx = createContext<Ports | null>(null)

export function PortsProvider({ ports, children }: { ports: Ports; children: ReactNode }) {
  return <Ctx.Provider value={ports}>{children}</Ctx.Provider>
}

export function usePorts(): Ports {
  const v = useContext(Ctx)
  if (!v) throw new Error('PortsProvider 밖에서 usePorts 를 불렀다')
  return v
}
