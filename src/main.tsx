import { BrowserRouter } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import AnimatedRoutes from './components/AnimatedRoutes'
import GlobalBackground from './components/GlobalBackground'
import ScrollTopHomeSwitch from './components/ScrollTopHomeSwitch'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <GlobalBackground />
    <ScrollTopHomeSwitch />
    <AnimatedRoutes />
  </BrowserRouter>
)
