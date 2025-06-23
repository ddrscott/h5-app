import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ColyseusProvider } from './contexts/ColyseusContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ColyseusProvider>
      <App />
    </ColyseusProvider>
  </StrictMode>,
)
