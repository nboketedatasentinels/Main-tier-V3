import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

const globalWindow = window as Window & {
  __t4lUnhandledRejectionLoggerInstalled?: boolean
}

if (!globalWindow.__t4lUnhandledRejectionLoggerInstalled) {
  globalWindow.__t4lUnhandledRejectionLoggerInstalled = true
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Global] Unhandled promise rejection', {
      reason: event.reason,
      stack: event.reason instanceof Error ? event.reason.stack : undefined,
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
