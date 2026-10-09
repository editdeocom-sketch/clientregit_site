import { lazy, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { CurrencyProvider } from '@/lib/currency'
import { SiteLayout } from '@/components/SiteLayout'
import { Landing } from '@/pages/Landing'

const Auth = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.Auth })))
const Checkout = lazy(() => import('@/pages/Checkout').then((m) => ({ default: m.Checkout })))
const Account = lazy(() => import('@/pages/Account').then((m) => ({ default: m.Account })))
const Admin = lazy(() => import('@/pages/Admin').then((m) => ({ default: m.Admin })))
const Privacy = lazy(() => import('@/pages/legal/Legal').then((m) => ({ default: m.Privacy })))
const Terms = lazy(() => import('@/pages/legal/Legal').then((m) => ({ default: m.Terms })))
const Refunds = lazy(() => import('@/pages/legal/Legal').then((m) => ({ default: m.Refunds })))

export function App(): ReactNode {
  return (
    <CurrencyProvider>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/checkout/:planId" element={<Checkout />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/refunds" element={<Refunds />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </CurrencyProvider>
  )
}
