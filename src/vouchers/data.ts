import { categories, shops, type Shop } from '../data/shops'
import { festival } from '../data/festival'

// 1 voucher per full ₹1,000: the same rule the server uses for the QR form (server/shared.mjs).
export { RUPEES_PER_VOUCHER, eligibleVouchers } from '../../server/shared.mjs'

// MOCK: shop numbers and floor plan are placeholders until the mall shares the real layout.
const floors = [
  { prefix: 'G', floor: 'Ground floor' },
  { prefix: 'F', floor: 'First floor' },
  { prefix: 'S', floor: 'Second floor' },
] as const
const wings = ['Main road wing', 'Atrium', 'Parking side wing']

export interface ShopRow extends Shop {
  shopNo: string
  floor: string
  wing: string
  location: string
  categoryLabel: string
}

export const shopRows: ShopRow[] = shops.map((shop, i) => {
  const { prefix, floor } = floors[Math.floor(i / 9)]
  const unit = (i % 9) + 1
  const wing = wings[Math.floor((unit - 1) / 3)]
  return {
    ...shop,
    shopNo: `${prefix}-${String(unit).padStart(2, '0')}`,
    floor,
    wing,
    location: `${floor} · ${wing}`,
    categoryLabel: categories.find((c) => c.id === shop.category)?.label ?? shop.category,
  }
})

export const shopById = Object.fromEntries(shopRows.map((s) => [s.id, s]))

export const places = [
  'Edakkara', 'Nilambur', 'Vazhikkadavu', 'Pothukal', 'Chungathara', 'Karulai',
  'Moothedam', 'Marutha', 'Palemad', 'Uppada', 'Munderi', 'Kalikavu', 'Manjeri', 'Wandoor',
]

export type IssueStatus = 'sent' | 'pending'

/** A sponsor printed on the coupon: their shop name and logo (small data URL). */
export interface Sponsor {
  /** Derived from name + image, so editing either makes a new version and old vouchers keep theirs. */
  id: string
  /** Shop name. */
  name: string
  /** Logo. */
  image: string
}

/** A purchase that earned vouchers. */
export interface Issue {
  id: string
  createdAt: string
  shopId: string
  customerName: string
  phone: string
  place: string
  billNo: string
  codes: string[]
  status: IssueStatus
  sentAt?: string
  /** Ids into the sponsor library — images are stored once there, not copied onto every voucher. */
  sponsorIds?: string[]
  /** Public link to the customer's coupon page, reserved when the voucher is made. */
  couponUrl?: string
  /** True until the coupon image has been uploaded to that link. */
  couponPending?: boolean
  /** Login that issued it (a shop, or the mall admin); "qr-form" when the customer's form made it. */
  issuedBy?: string
  /** The bill amount in rupees, when it was entered. */
  billAmount?: number
  /** Where it was made: the desk, the desk releasing a QR customer, or the QR form by itself. */
  source?: 'desk' | 'qr-release' | 'qr-form'
  /** Shop name as printed on the coupon. */
  shopLabel?: string
  /** The QR form entry it was made for. */
  entryId?: string
}

/**
 * Shrinks an uploaded sponsor logo or photo so it fits in localStorage. The whole image is kept
 * (no cropping, aspect ratio preserved). Logos with a transparent background stay PNG;
 * everything else (photos) becomes JPEG, which is far smaller.
 */
export async function sponsorImage(file: File, maxW = 360, maxH = 270): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxW / bitmap.width, maxH / bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) return canvas.toDataURL('image/png')
  }
  return canvas.toDataURL('image/jpeg', 0.85)
}

// ---------- sponsors seen on vouchers ----------
// The server sends each voucher's sponsors (logo + name) alongside the vouchers; this cache lets
// any coupon or message look them up by id.

const sponsorCache = new Map<string, Sponsor>()

export function cacheSponsors(sponsors: Record<string, Sponsor>) {
  for (const s of Object.values(sponsors)) sponsorCache.set(s.id, s)
}

export const sponsorsFor = (issue: Issue): Sponsor[] =>
  (issue.sponsorIds ?? []).map((id) => sponsorCache.get(id)).filter((s): s is Sponsor => Boolean(s))

// ---------- WhatsApp ----------

export type WhatsAppTarget = 'web' | 'app'

export const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

/** The greeting sent with the coupon image. WhatsApp shows *text* as bold. */
export function voucherMessage(issue: Issue) {
  const shop = shopById[issue.shopId]
  const n = issue.codes.length
  const sponsors = sponsorsFor(issue)
  return [
    `🎄 *Merry Christmas & Happy New Year, ${issue.customerName}!* ✨`,
    '',
    `Thank you for shopping at *${shop.name}* (Shop ${shop.shopNo}, ${shop.floor}) during the Dubai Mall Edakkara ${festival.name}.`,
    ...(issue.billNo ? [`Bill ${issue.billNo}`] : []),
    '',
    `🎟️ Your ${n} lucky-draw voucher${n === 1 ? '' : 's'}:`,
    ...issue.codes.map((c, i) => `${i + 1}. *${c}*`),
    '',
    ...(issue.couponUrl
      ? ['📥 *View & download your coupon:*', issue.couponUrl, '', 'Save it to your phone and keep this message to claim your prize.']
      : ['Your coupon is attached as an image — save it to your phone and keep this message to claim your prize.']),
    `🏆 ${festival.drawLabel}.`,
    ...(sponsors.length ? ['', `Sponsored by: ${sponsors.map((s) => s.name).join(', ')}`] : []),
    '',
    'Wishing you and your family a joyful season! 🎁',
    '— Dubai Mall Edakkara',
  ].join('\n')
}

export function whatsappUrl(issue: Issue, target: WhatsAppTarget) {
  const phone = `91${issue.phone}`
  const text = encodeURIComponent(voucherMessage(issue))
  return target === 'web'
    ? `https://web.whatsapp.com/send?phone=${phone}&text=${text}`
    : // Straight into the installed app: wa.me would first load a web page that asks to open it.
      `whatsapp://send?phone=${phone}&text=${text}`
}
