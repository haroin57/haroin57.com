import { BrowserRouter } from 'react-router-dom'
import { createRoot, hydrateRoot } from 'react-dom/client'
import AnimatedRoutes from './components/AnimatedRoutes'
import { preloadRoutesForPath } from './lib/preloadRoutes'
import GlobalBackground from './components/GlobalBackground'
import ScrollTopHomeSwitch from './components/ScrollTopHomeSwitch'
import { AdminAuthProvider } from './contexts/AdminAuthContext'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

const normalizePath = (path: string) => {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1)
  return path
}

const app = (
  <BrowserRouter>
    <AdminAuthProvider>
      <GlobalBackground />
      <ScrollTopHomeSwitch />
      <AnimatedRoutes />
    </AdminAuthProvider>
  </BrowserRouter>
)

const prerenderedPath = rootElement.getAttribute('data-prerendered-path')
const shouldHydrate =
  rootElement.hasChildNodes() &&
  typeof prerenderedPath === 'string' &&
  normalizePath(prerenderedPath) === normalizePath(window.location.pathname)

if (shouldHydrate) {
  void preloadRoutesForPath(window.location.pathname)
    .catch((error) => {
      console.error('Failed to preload route for hydration:', error)
    })
    .finally(() => {
      hydrateRoot(rootElement, app)
    })
} else {
  // SPA fallbackなどで別ページのHTMLが入っている場合、hydrationせずに作り直す
  if (rootElement.hasChildNodes()) {
    rootElement.innerHTML = ''
  }
  createRoot(rootElement).render(app)
}
