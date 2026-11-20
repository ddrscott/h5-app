import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fraunces/soft.css'
import './index.css'
import { MotionConfig } from 'motion/react'
import App from './App.tsx'
import { RoomProvider } from './contexts/RoomContext'
import { AccountProvider } from './contexts/AccountContext'
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
    <MotionConfig reducedMotion="user">
      <AccountProvider>
        <RoomProvider>
          <App />
        </RoomProvider>
      </AccountProvider>
    </MotionConfig>
  </StrictMode>,
)
