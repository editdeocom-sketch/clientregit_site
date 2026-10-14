import nodemailer from 'nodemailer'
import { HttpError } from './http.js'
import { SITE, DOWNLOADS } from '../../src/shared/site.js'
import { formatMoney } from '../../src/shared/plans.js'

type Currency = 'INR' | 'USD'

const ORIGIN = (process.env.SITE_URL || 'https://clientregit.com').replace(/\/+$/, '')

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendMail(to: string, subject: string, text: string, html: string): Promise<void> {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) {
    throw new HttpError(500, 'Email service is not configured yet — set SMTP_HOST, SMTP_USER and SMTP_PASS.')
  }
  const port = Number(process.env.SMTP_PORT ?? 465)
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  })
  try {
    await transporter.sendMail({
      from: `"ClientRegit" <${process.env.SMTP_FROM || user}>`,
      to,
      subject,
      text,
      html
    })
  } catch (error) {
    console.error('[mail] send failed:', error instanceof Error ? error.message : error)
    throw new HttpError(502, 'Could not send the email — check the SMTP settings.')
  }
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#d4af37;color:#14161c;font-weight:bold;text-decoration:none;border-radius:8px;padding:12px 24px;font-size:14px;">${label}</a>`
}

function layout(title: string, inner: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f3ef;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:460px;margin:32px auto;background:#ffffff;border-radius:16px;border:1px solid #e7e5de;overflow:hidden;">
      <div style="background:#14161c;padding:22px 32px;">
        <span style="color:#d4af37;font-size:18px;font-weight:bold;letter-spacing:0.5px;">${SITE.name}</span>
      </div>
      <div style="padding:32px;">
        <h1 style="margin:0 0 14px;font-size:20px;color:#14161c;">${title}</h1>
        ${inner}
      </div>
      <div style="padding:16px 32px;border-top:1px solid #eceae3;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">
          ${SITE.name} &middot; ${SITE.address}<br />
          Support: <a href="mailto:${SITE.supportEmail}" style="color:#b08d1f;">${SITE.supportEmail}</a>
        </p>
      </div>
    </div>
  </body>
</html>`
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const html = layout(
    'Verify your email',
    `<p style="margin:0 0 4px;color:#4b5563;font-size:14px;">Enter this code to finish creating your account:</p>
     <div style="margin:24px 0;text-align:center;">
       <span style="display:inline-block;font-family:monospace;font-size:34px;letter-spacing:10px;font-weight:bold;color:#14161c;background:#faf9f5;border:1px dashed #d4af37;border-radius:12px;padding:16px 10px 16px 20px;">${code}</span>
     </div>
     <p style="margin:0;color:#9ca3af;font-size:12px;">This code expires in 10 minutes. If you didn&rsquo;t request it, you can safely ignore this email.</p>`
  )
  await sendMail(to, `${code} is your ${SITE.name} verification code`, `Your verification code is ${code}. It expires in 10 minutes.`, html)
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,'
  const html = layout(
    'Welcome to ClientRegit!',
    `<p style="margin:0 0 12px;color:#4b5563;font-size:14px;">${greeting}</p>
     <p style="margin:0 0 20px;color:#4b5563;font-size:14px;">
       Your email is verified and your account is ready. Use it to store license keys,
       download the app, and manage your purchases &mdash; all in one place.
     </p>
     <p style="margin:0 0 8px;text-align:center;">
       ${button(DOWNLOADS.windows, 'Download for Windows')}
     </p>
     <p style="margin:16px 0 0;text-align:center;">
       ${button(`${ORIGIN}/account`, 'My account')}
     </p>`
  )
  await sendMail(to, `Welcome to ${SITE.name} — your account is verified`, `Your ${SITE.name} account is ready. Download the app or open your account.`, html)
}

export interface PurchaseEmailParams {
  to: string
  name: string
  kind: 'plan' | 'seat_addon'
  planName: string
  seats: number
  extraSeats: number
  orderId: string
  paymentId: string
  paidAt: string
  subtotal: number
  taxPercent: number
  taxAmount: number
  discount: number
  coupon: string | null
  total: number
  currency: Currency
  licenseKey: string
}

export async function sendPurchaseEmail(p: PurchaseEmailParams): Promise<void> {
  const isFree = p.paymentId.startsWith('free_')
  const money = (amount: number): string => formatMoney(amount, p.currency)

  const rows: string[][] = [
    ['Order ID', `<code style="font-size:12px;">${escapeHtml(p.orderId)}</code>`],
    ...(isFree ? [] : ([['Payment ID', `<code style="font-size:12px;">${escapeHtml(p.paymentId)}</code>`]] as string[][])),
    ['Plan', escapeHtml(p.planName)],
    ['Date', new Date(p.paidAt).toUTCString()],
    ['Subtotal', money(p.subtotal)],
    ...(p.taxAmount > 0 ? ([['GST', `${money(p.taxAmount)} (${p.taxPercent}%)`]] as string[][]) : []),
    ...(p.discount > 0 ? ([['Discount', `− ${money(p.discount)}${p.coupon ? ` (${escapeHtml(p.coupon)})` : ''}`]] as string[][]) : [])
  ]
  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:7px 0;color:#6b7280;font-size:13px;border-bottom:1px solid #f0eee7;">${label}</td>` +
        `<td style="padding:7px 0;text-align:right;color:#14161c;font-size:13px;border-bottom:1px solid #f0eee7;">${value}</td></tr>`
    )
    .join('')

  const headline =
    p.kind === 'seat_addon'
      ? `Payment received — ${p.extraSeats} extra member${p.extraSeats === 1 ? '' : 's'} added to your ${escapeHtml(p.planName)} key.`
      : `Payment received — your ${escapeHtml(p.planName)} license is active.`

  const html = layout(
    'Purchase confirmed',
    `<p style="margin:0 0 16px;color:#4b5563;font-size:14px;">${p.name ? `${escapeHtml(p.name)}, y` : 'Y'}ou're all set. ${headline}</p>
     <table style="width:100%;border-collapse:collapse;margin:0 0 6px;">
       ${tableRows}
       <tr>
         <td style="padding:12px 0 0;color:#14161c;font-size:15px;font-weight:bold;">Total paid</td>
         <td style="padding:12px 0 0;text-align:right;color:#14161c;font-size:15px;font-weight:bold;">${money(p.total)}</td>
       </tr>
     </table>
     <div style="margin:22px 0 6px;text-align:center;background:#faf9f5;border:1px dashed #d4af37;border-radius:12px;padding:18px 16px;">
       <p style="margin:0 0 6px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1px;">License key</p>
       <p style="margin:0;font-family:monospace;font-size:18px;letter-spacing:2px;font-weight:bold;color:#14161c;">${p.licenseKey}</p>
     </div>
     <p style="margin:6px 0 0;color:#9ca3af;font-size:12px;text-align:center;">
       ${p.kind === 'seat_addon' ? 'Updated seat count' : p.seats > 1 ? `${p.seats}-seat key` : 'Single seat'} &middot; paste the key in the ${SITE.name} app to activate
     </p>
     <p style="margin:22px 0 0;text-align:center;">
       ${button(`${ORIGIN}/account`, 'Open my account')}
     </p>`
  )

  const subject = `${p.planName} license key — order confirmed`
  const text = `Payment received. ${p.planName} plan. Total paid: ${money(p.total)}. License key: ${p.licenseKey}`
  await sendMail(p.to, subject, text, html)
}

export async function sendResetEmail(to: string, actionLink: string): Promise<void> {
  const html = layout(
    'Reset your password',
    `<p style="margin:0 0 16px;color:#4b5563;font-size:14px;">
       We received a request to reset the password for <strong>${escapeHtml(to)}</strong>.
     </p>
     <p style="margin:0 0 8px;text-align:center;">
       ${button(actionLink, 'Reset password')}
     </p>
     <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;">
       This link is single-use and expires shortly. If you didn&rsquo;t request it, you can safely
       ignore this email &mdash; your password will not change.
     </p>`
  )
  await sendMail(to, `Reset your ${SITE.name} password`, `Reset your password: ${actionLink}`, html)
}
