import { BrowserRouter } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import AnimatedRoutes from './components/AnimatedRoutes'
import GlobalBackground from './components/GlobalBackground'
import ScrollTopHomeSwitch from './components/ScrollTopHomeSwitch'
import { AdminAuthProvider } from './contexts/AdminAuthContext'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AdminAuthProvider>
      <GlobalBackground />
      <ScrollTopHomeSwitch />
      <AnimatedRoutes />
    </AdminAuthProvider>
  </BrowserRouter>
)
