import { getFontEmbedCSS, toBlob } from 'html-to-image'

/**
 * Sending the coupon as a picture.
 *
 * WhatsApp send links (wa.me / web.whatsapp.com/send) can only pre-fill text, so the image goes
 * a different way. When the coupon server is set up, the PNG is saved there and the greeting
 * carries a link to the customer's coupon page. Otherwise it's copied to the clipboard for staff to paste (Ctrl+V), or
 * downloaded / shared through the share sheet. Sending images to a number fully automatically
 * needs the WhatsApp Business (Cloud) API and a server.
 */

// ---------- coupon server (server/index.mjs) ----------

declare global {
  interface Window {
    /** Set by /desk-config.js, which the deploy script writes on the server (see deploy/). */
    DME_DESK_CONFIG?: { couponApiUrl?: string; couponApiKey?: string }
  }
}

// The live server's details come from /desk-config.js at runtime, so the same build works anywhere
// and no key is baked into the bundle. Locally, .env.local fills them in instead.
const api = (() => {
  const runtime = typeof window === 'undefined' ? undefined : window.DME_DESK_CONFIG
  const url = (runtime?.couponApiUrl || import.meta.env.VITE_COUPON_API_URL)?.replace(/\/+$/, '')
  const key = runtime?.couponApiKey || import.meta.env.VITE_COUPON_API_KEY
  return url && key ? { url, key } : null
})()

/** True when download links are switched on (desk-config.js on the server, or .env.local locally). */
export const couponLinksEnabled = api !== null

/** What the coupon server stores alongside the image, for the customer's coupon page. */
export interface CouponUpload {
  issueId: string
  customer: string
  shop: string
  codes: string[]
  festival: string
  drawLabel: string
}

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

/**
 * Saves the coupon on the mall's coupon server and returns the customer's link (/c/<id>),
 * which opens a page with the coupon and a Download button. Sending the same purchase
 * again returns the same link.
 */
export async function uploadCoupon(blob: Blob, coupon: CouponUpload): Promise<string> {
  if (!api) throw new Error('Coupon server is not set up')
  const res = await fetch(`${api.url}/api/coupons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Desk-Key': api.key },
    body: JSON.stringify({ ...coupon, image: await blobToDataUrl(blob) }),
  })
  if (!res.ok) throw new Error(`Coupon upload failed (${res.status})`)
  const { url } = (await res.json()) as { url: string }
  return url
}

let fontCss: Promise<string> | null = null

/** Renders a DOM node (the hidden, fixed-width coupon) to a sharp PNG. */
export async function nodeToPng(node: HTMLElement): Promise<Blob> {
  // Embed the page's web fonts once, so the image uses Fraunces / Nunito Sans like the screen.
  fontCss ??= getFontEmbedCSS(node).catch(() => '')
  const blob = await toBlob(node, { pixelRatio: 2, fontEmbedCSS: await fontCss, cacheBust: false })
  if (!blob) throw new Error('Could not create the coupon image')
  return blob
}

export const couponFileName = (codes: string[]) => `dubai-mall-coupon-${codes[0] ?? 'voucher'}.png`

/** Puts the image on the clipboard. Returns false when the browser blocks it. */
export async function copyImage(blob: Promise<Blob> | Blob): Promise<boolean> {
  try {
    if (!('ClipboardItem' in window) || !navigator.clipboard?.write) return false
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}

export function downloadImage(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** True where the system share sheet can take an image (Android, iOS, Windows/macOS Chrome & Edge). */
export function canShareImage() {
  try {
    const probe = new File([new Blob()], 'probe.png', { type: 'image/png' })
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}

/** Opens the share sheet with the coupon image and the greeting. Returns false if cancelled or unsupported. */
export async function shareImage(blob: Blob, fileName: string, text: string): Promise<boolean> {
  try {
    await navigator.share({ files: [new File([blob], fileName, { type: 'image/png' })], text })
    return true
  } catch {
    return false
  }
}
