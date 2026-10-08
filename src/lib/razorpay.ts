export interface RazorpayHandlerResponse {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

interface RazorpayInstance {
  open(): void
}

type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance

declare global {
  interface Window {
    Razorpay?: RazorpayCtor
  }
}

let loader: Promise<void> | null = null

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Could not load the payment window. Check your internet.'))
      document.body.appendChild(script)
    })
  }
  return loader
}

export async function openCheckout(options: {
  keyId: string
  orderId: string
  amount: number
  currency: string
  email?: string
  onSuccess: (response: RazorpayHandlerResponse) => void
  onFailure: (message: string) => void
}): Promise<void> {
  await loadCheckoutScript()
  if (!window.Razorpay) throw new Error('Payment window failed to load.')
  const instance = new window.Razorpay({
    key: options.keyId,
    order_id: options.orderId,
    amount: options.amount,
    currency: options.currency,
    name: 'ClientRegit',
    description: 'ClientRegit license',
    prefill: { email: options.email ?? '' },
    theme: { color: '#C89A2B' },
    handler: (response: RazorpayHandlerResponse) => options.onSuccess(response),
    modal: {
      ondismiss: () => options.onFailure('Payment cancelled.')
    }
  })
  instance.open()
}
