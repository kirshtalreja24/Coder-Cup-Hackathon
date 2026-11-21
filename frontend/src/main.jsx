import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { LangProvider } from './i18n'
import { startAutoSync } from './offline'
import { ToastProvider } from './ui'
import './styles.css'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
startAutoSync()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LangProvider>
        <ToastProvider><App /></ToastProvider>
      </LangProvider>
    </BrowserRouter>
  </React.StrictMode>
)
