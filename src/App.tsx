import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { CurrencyProvider } from '@/lib/currency'
import { SiteLayout } from '@/components/SiteLayout'
import { Landing } from '@/pages/Landing'
import { Auth } from '@/pages/Auth'
import { Checkout } from '@/pages/Checkout'
import { Account } from '@/pages/Account'
import { Admin } from '@/pages/Admin'
import { Privacy, Terms, Refunds } from '@/pages/legal/Legal'

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
