import { BrowserRouter } from 'react-router-dom'
import { createRoot, hydrateRoot } from 'react-dom/client'
import AnimatedRoutes from './components/AnimatedRoutes'
import GlobalBackground from './components/GlobalBackground'
import ScrollTopHomeSwitch from './components/ScrollTopHomeSwitch'
import { AdminAuthProvider } from './contexts/AdminAuthContext'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
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

if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, app)
} else {
  createRoot(rootElement).render(app)
}
