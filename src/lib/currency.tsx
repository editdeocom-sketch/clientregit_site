import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { detectCurrency, type CurrencyCode } from '@shared/plans'

interface CurrencyContextValue {
  currency: CurrencyCode
  setCurrency: (currency: CurrencyCode) => void
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)
const STORAGE_KEY = 'cr_currency'

export function CurrencyProvider({ children }: { children: ReactNode }): ReactNode {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'INR' || stored === 'USD') return stored
    return detectCurrency()
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currency)
  }, [currency])

  const setCurrency = (next: CurrencyCode): void => setCurrencyState(next)

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency(): CurrencyContextValue {
  const value = useContext(CurrencyContext)
  if (!value) throw new Error('useCurrency must be used inside CurrencyProvider')
  return value
}
