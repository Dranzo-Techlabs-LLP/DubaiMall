import { cacheSponsors, type Issue, type Sponsor } from './data'

/**
 * Talks to the voucher desk server (server/index.mjs): logins, vouchers, sponsors and coupons.
 * The server address comes from /desk-config.js on the live site (written by deploy.sh),
 * or from VITE_COUPON_API_URL in .env.local during development.
 */

declare global {
  interface Window {
    DME_DESK_CONFIG?: { couponApiUrl?: string }
  }
}

const base = (
  (typeof window === 'undefined' ? undefined : window.DME_DESK_CONFIG?.couponApiUrl) ||
  import.meta.env.VITE_COUPON_API_URL ||
  ''
).replace(/\/+$/, '')

/** False when the desk doesn't know where its server is (missing desk-config.js / .env.local). */
export const apiConfigured = base !== ''

export type Role = 'admin' | 'shop'
export interface User {
  username: string
  role: Role
  shopId: string | null
}
export interface Login extends User {
  lastLoginAt: string | null
  passwordSetAt: string | null
}

// ---------- session token ----------

const TOKEN_KEY = 'dme-desk-session'

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // storage blocked: the login lasts until the tab closes
  }
}
let token = readToken()

export const hasSession = () => token !== null

/** Lets the app return to the login screen when the server says the session has ended. */
const expiredListeners = new Set<() => void>()
export function onSessionExpired(listener: () => void) {
  expiredListeners.add(listener)
  return () => void expiredListeners.delete(listener)
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(base + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Can’t reach the voucher server. Check the internet connection and try again.', 0)
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (res.status === 401 && path !== '/api/login') {
    token = null
    writeToken(null)
    expiredListeners.forEach((l) => l())
  }
  if (!res.ok) throw new ApiError(data.error || `Something went wrong (${res.status})`, res.status)
  return data
}

// ---------- logins ----------

export async function login(username: string, password: string): Promise<User> {
  const data = await request<{ token: string; user: User }>('POST', '/api/login', { username, password })
  token = data.token
  writeToken(data.token)
  return data.user
}

export async function logout() {
  try {
    await request('POST', '/api/logout')
  } catch {
    // already signed out on the server
  }
  token = null
  writeToken(null)
}

export const me = () => request<{ user: User }>('GET', '/api/me').then((d) => d.user)

export const listLogins = () => request<{ users: Login[] }>('GET', '/api/users').then((d) => d.users)
export const setPassword = (username: string, password: string) =>
  request<{ user: User }>('PUT', `/api/users/${encodeURIComponent(username)}`, { password })
export const removeLogin = (username: string) => request('DELETE', `/api/users/${encodeURIComponent(username)}`)

// ---------- vouchers ----------

export async function listIssues(): Promise<Issue[]> {
  const data = await request<{ issues: Issue[]; sponsors: Record<string, Sponsor> }>('GET', '/api/issues')
  cacheSponsors(data.sponsors)
  return data.issues
}

export interface NewIssue {
  shopId: string
  customerName: string
  phone: string
  place: string
  billNo: string
  count: number
}

export async function createIssue(draft: NewIssue): Promise<Issue> {
  const data = await request<{ issue: Issue; sponsors: Record<string, Sponsor> }>('POST', '/api/issues', draft)
  cacheSponsors(data.sponsors)
  return data.issue
}

export const markSent = (id: string) =>
  request<{ issue: Issue }>('POST', `/api/issues/${encodeURIComponent(id)}/sent`).then((d) => d.issue)

// ---------- sponsors (each shop's own list) ----------

export const getSponsors = (shopId: string) =>
  request<{ sponsors: Sponsor[] }>('GET', `/api/sponsors?shop=${encodeURIComponent(shopId)}`).then((d) => d.sponsors)

export const saveSponsors = (shopId: string, sponsors: { name: string; image: string }[]) =>
  request<{ sponsors: Sponsor[] }>('PUT', '/api/sponsors', { shopId, sponsors }).then((d) => d.sponsors)

// ---------- coupon images ----------

/** Labels shown on the customer's coupon page; the codes and name come from the saved voucher. */
export interface CouponUpload {
  issueId: string
  shop: string
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

/** Saves the coupon image and returns the customer's link (/c/<id>). Same purchase → same link. */
export async function uploadCoupon(blob: Blob, coupon: CouponUpload): Promise<string> {
  const data = await request<{ url: string }>('POST', '/api/coupons', { ...coupon, image: await blobToDataUrl(blob) })
  return data.url
}
