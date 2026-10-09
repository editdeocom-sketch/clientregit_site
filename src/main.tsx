import { StrictMode, Suspense, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/index.css'

function Fallback(): ReactNode {
  return <div className="py-24 text-center text-sm text-muted">Loading…</div>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <Suspense fallback={<Fallback />}>
          <App />
        </Suspense>
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>
)
