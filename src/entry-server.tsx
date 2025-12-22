import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { AdminAuthProvider } from './contexts/AdminAuthContext'
import GlobalBackground from './components/GlobalBackground'
import ScrollTopHomeSwitch from './components/ScrollTopHomeSwitch'
import ServerRoutes from './components/ServerRoutes'

export function render(url: string) {
  return renderToString(
    <StaticRouter location={url}>
      <AdminAuthProvider>
        <GlobalBackground />
        <ScrollTopHomeSwitch />
        <ServerRoutes />
      </AdminAuthProvider>
    </StaticRouter>
  )
}
