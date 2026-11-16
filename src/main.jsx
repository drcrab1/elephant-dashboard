import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './error-boundary.jsx'
import { installChunkReload } from './chunk-reload.js'
import { UiHost } from './ui-kit.jsx'

installChunkReload()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <UiHost />
  </StrictMode>,
)
