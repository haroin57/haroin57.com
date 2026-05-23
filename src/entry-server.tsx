import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import GlobalBackground from './components/GlobalBackground'
import ScrollTopHomeSwitch from './components/ScrollTopHomeSwitch'
import ServerRoutes from './components/ServerRoutes'

export function render(url: string) {
  return renderToString(
    <StaticRouter location={url}>
      <GlobalBackground />
      <ScrollTopHomeSwitch />
      <ServerRoutes />
    </StaticRouter>
  )
}
