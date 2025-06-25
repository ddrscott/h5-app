import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ColyseusProvider } from './contexts/ColyseusContext'
import { registerSW } from 'virtual:pwa-register'

// Register service worker with update prompt
const updateSW = registerSW({
  onNeedRefresh() {
    const updateConfirmed = window.confirm(
      'A new version is available! Click OK to update.'
    );
    if (updateConfirmed) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App is ready for offline use!');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ColyseusProvider>
      <App />
    </ColyseusProvider>
  </StrictMode>,
)
