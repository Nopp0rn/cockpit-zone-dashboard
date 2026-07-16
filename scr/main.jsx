import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={
      <div style={{
        color:'#fff',
        padding:'40px',
        fontFamily:'sans-serif'
      }}>
        Loading Cockpit Zone Dashboard...
      </div>
    }>
      <App />
    </Suspense>
  </StrictMode>
)
