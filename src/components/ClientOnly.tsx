import { useSyncExternalStore, type ReactNode } from 'react'

type ClientOnlyProps = {
  children: ReactNode
}

const emptySubscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

function ClientOnly({ children }: ClientOnlyProps) {
  const isClient = useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot)

  if (!isClient) return null
  return <>{children}</>
}

export default ClientOnly
