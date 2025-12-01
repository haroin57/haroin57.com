import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import App from './App'
import Posts from './routes/Posts'
import PostDetail from './routes/PostDetail'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/posts" element={<Posts />} />
      <Route path="/posts/:slug" element={<PostDetail />} />
    </Routes>
  </BrowserRouter>
)
