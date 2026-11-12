import { useEffect, useMemo, useState } from 'react'
import { categories, shops, type Shop } from '../data/shops'
import { festival } from '../data/festival'

/** One lucky-draw voucher for every full ₹1,000 on the bill. */
export const RUPEES_PER_VOUCHER = 1000

export const eligibleVouchers = (amount: number) =>
  Number.isFinite(amount) && amount > 0 ? Math.floor(amount / RUPEES_PER_VOUCHER) : 0

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
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function makeCode(taken: Set<string>, rand: () => number = Math.random) {
  for (;;) {
    let body = ''
    for (let i = 0; i < 6; i++) body += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)]
    const code = `DME-${body}`
    if (!taken.has(code)) {
      taken.add(code)
      return code
    }
  }
}

export const allCodes = (issues: Issue[]) => new Set(issues.flatMap((i) => i.codes))

// ---------- mock seed ----------

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const firstNames = [
  'Aysha', 'Fathima', 'Muhammed', 'Arjun', 'Anjali', 'Shamna', 'Rahul', 'Nihal', 'Sreelakshmi', 'Jaseela',
  'Abdul Rasheed', 'Neethu', 'Vishnu', 'Hiba', 'Joseph', 'Sneha', 'Faisal', 'Divya', 'Ameen', 'Reshma',
  'Thomas', 'Safa', 'Akhil', 'Mariya', 'Shahid', 'Lakshmi', 'Irfan', 'Gopika', 'Basil', 'Nasrin',
]
const initialsPool = ['K', 'P', 'M', 'T', 'V', 'C', 'E', 'A']

// Typical bill sizes per category, in rupees.
const spend: Record<string, [number, number]> = {
  jewellery: [6000, 85000],
  fashion: [800, 9000],
  beauty: [500, 6000],
  mobiles: [2500, 42000],
  daily: [350, 5500],
  gifts: [600, 12000],
  services: [1000, 15000],
}

function seedIssues(): Issue[] {
  const rand = mulberry32(2026)
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)]
  const taken = new Set<string>()
  const now = Date.now()
  const issues: Issue[] = []

  for (let n = 0; n < 72; n++) {
    const shop = pick(shopRows)
    const [lo, hi] = spend[shop.category]
    // Skew towards smaller bills, rounded to ₹10.
    const amount = Math.round((lo + (hi - lo) * rand() ** 2) / 10) * 10
    const eligible = eligibleVouchers(amount)
    if (eligible === 0) continue
    const count = rand() < 0.85 ? eligible : Math.max(1, eligible - 1 - Math.floor(rand() * 2))
    const createdAt = new Date(now - Math.floor(rand() * 14 * 24 * 60) * 60_000)
    const status: IssueStatus = rand() < 0.86 ? 'sent' : 'pending'
    issues.push({
      id: `iss-${n + 1}`,
      createdAt: createdAt.toISOString(),
      shopId: shop.id,
      customerName: `${pick(firstNames)} ${pick(initialsPool)}`,
      // MOCK numbers in a dummy range — swap for real customers before sending.
      phone: `90000${String(10000 + Math.floor(rand() * 89999)).slice(0, 5)}`,
      place: pick(places),
      billNo: `${shop.shopNo.replace('-', '')}/${String(1200 + n * 7 + Math.floor(rand() * 6))}`,
      codes: Array.from({ length: count }, () => makeCode(taken, rand)),
      status,
      sentAt: status === 'sent' ? new Date(createdAt.getTime() + 60_000).toISOString() : undefined,
    })
  }
  return issues.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// ---------- store (localStorage, mock backend) ----------

const STORAGE_KEY = 'dme-voucher-desk-v1'

function load(): Issue[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Issue[]
  } catch {
    // storage blocked or corrupt — fall back to seed
  }
  return seedIssues()
}

export function useIssues() {
  const [issues, setIssues] = useState<Issue[]>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(issues))
    } catch {
      // ignore — demo still works in memory
    }
  }, [issues])

  const actions = useMemo(
    () => ({
      add: (issue: Issue) => setIssues((list) => [issue, ...list]),
      markSent: (id: string) =>
        setIssues((list) =>
          list.map((i) => (i.id === id ? { ...i, status: 'sent' as const, sentAt: new Date().toISOString() } : i)),
        ),
      reset: () => setIssues(seedIssues()),
    }),
    [],
  )

  return { issues, ...actions }
}

// ---------- WhatsApp ----------

export type WhatsAppTarget = 'web' | 'app'

export const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

export function voucherMessage(issue: Issue) {
  const shop = shopById[issue.shopId]
  const n = issue.codes.length
  return [
    `*Dubai Mall Edakkara — ${festival.name}*`,
    '',
    `Hi ${issue.customerName}, thank you for shopping at *${shop.name}* (Shop ${shop.shopNo}, ${shop.floor}).`,
    ...(issue.billNo ? [`Bill ${issue.billNo}`] : []),
    '',
    `Your ${n} lucky-draw voucher${n === 1 ? '' : 's'}:`,
    ...issue.codes.map((c, i) => `${i + 1}. ${c}`),
    '',
    `${festival.drawLabel}. Keep this message to claim your prize.`,
  ].join('\n')
}

export function whatsappUrl(issue: Issue, target: WhatsAppTarget) {
  const phone = `91${issue.phone}`
  const text = encodeURIComponent(voucherMessage(issue))
  return target === 'web'
    ? `https://web.whatsapp.com/send?phone=${phone}&text=${text}`
    : `https://wa.me/${phone}?text=${text}`
}
