import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import '@/index.css'

const root = createRoot(document.getElementById('root')!)
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Hide preloader once React has hydrated
const preloader = document.getElementById('preloader')
if (preloader) {
  preloader.classList.add('hidden')
  preloader.addEventListener('transitionend', () => preloader.remove())
}
