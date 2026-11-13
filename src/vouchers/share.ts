import { getFontEmbedCSS, toBlob } from 'html-to-image'

/**
 * Sending the coupon as a picture.
 *
 * WhatsApp send links (wa.me / web.whatsapp.com/send) can only pre-fill text, so the image goes
 * a different way: the PNG is saved on the desk server (see api.ts) and the greeting carries a
 * link to the customer's coupon page. Staff can also copy, download or share the image.
 * Sending images to a number fully automatically needs the WhatsApp Business (Cloud) API.
 */

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
