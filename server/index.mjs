// Coupon link server for the Dubai Mall Edakkara voucher desk.
//
// Also the voucher desk's backend: shop and admin logins, every shop's vouchers and sponsors.
// The desk uploads each coupon image here; the server stores it and returns a short
// link (/c/<id>) for the WhatsApp greeting. The link opens a page with the coupon and a Download
// button, and carries Open Graph tags so WhatsApp can show the coupon as a link preview.
//
// Plain Node with no dependencies. Stores coupons in SQLite (node:sqlite, Node 22.13+) when the
// Node version has it, otherwise as files — so it also runs on older Node versions on cPanel.
// Configure with .env next to this file (see .env.example) and start with `npm run server`,
// or on cPanel as a Node.js app with startup file app.js.

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

// Settings from .env next to this file. cPanel starts the app without command-line flags,
// so the server reads it itself (simple KEY=value lines, works on any Node version).
// Real environment variables win over the file.
try {
  for (const line of readFileSync(join(here, '.env'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
} catch {
  // no .env: use the real environment variables
}

// ---------- config ----------

const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '0.0.0.0'
const DATA_DIR = process.env.DATA_DIR || join(here, 'data')
/** Pages allowed to call the API (the voucher desk). */
const DESK_ORIGINS = (process.env.DESK_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean)
/** Address customers' phones use. Locally: this PC's Wi-Fi address. When hosted: https://your-domain. */
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://${lanAddress()}:${PORT}`).replace(/\/+$/, '')

const MAX_BODY = 6 * 1024 * 1024 // a coupon PNG is ~200 KB; sponsor logos up to 12 x 400 KB
const MAX_CODES = 500
const SESSION_DAYS = 14
const ID_PATTERN = '[A-Za-z0-9_-]{12}'

function lanAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) if (net.family === 'IPv4' && !net.internal) return net.address
  }
  return 'localhost'
}

// ---------- storage ----------
// SQLite when this Node has it (22.13+); otherwise one PNG + one JSON file per coupon.
// Force one with COUPON_STORE=sqlite or COUPON_STORE=files.

const store = await openStore()

async function openStore() {
  if (process.env.COUPON_STORE !== 'files') {
    try {
      const { DatabaseSync } = await import('node:sqlite')
      return sqliteStore(DatabaseSync)
    } catch (err) {
      if (process.env.COUPON_STORE === 'sqlite') throw err
    }
  }
  return fileStore()
}

function sqliteStore(DatabaseSync) {
  const file = process.env.DB_FILE || join(DATA_DIR, 'coupons.db')
  mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(`
    pragma journal_mode = wal;
    create table if not exists coupons (
      id          text primary key,           -- random, used in the public link
      issue_id    text not null unique,       -- the desk's purchase id: one coupon per purchase
      customer    text not null,
      shop        text not null,
      codes       text not null,              -- JSON array of voucher codes
      festival    text not null,
      draw_label  text not null,
      png         blob not null,
      width       integer not null,
      height      integer not null,
      created_at  text not null
    );
  `)
  db.exec(`
    create table if not exists docs (
      col   text not null,                     -- users, sessions, issues, sponsors, sponsorLib
      id    text not null,
      data  text not null,                     -- JSON
      primary key (col, id)
    );
  `)
  const docAll = db.prepare('select data from docs where col = ?')
  const docUpsert = db.prepare('insert into docs (col, id, data) values (?, ?, ?) on conflict (col, id) do update set data = excluded.data')
  const docRemove = db.prepare('delete from docs where col = ? and id = ?')
  const byIssue = db.prepare('select id from coupons where issue_id = ?')
  const byId = db.prepare('select * from coupons where id = ?')
  const insert = db.prepare(`
    insert into coupons (id, issue_id, customer, shop, codes, festival, draw_label, png, width, height, created_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  return {
    kind: `SQLite database ${file}`,
    docsLoad: (col) => docAll.all(col).map((r) => JSON.parse(r.data)),
    docPut: (col, id, doc) => docUpsert.run(col, id, JSON.stringify(doc)),
    docDelete: (col, id) => docRemove.run(col, id),
    idForIssue: (issueId) => byIssue.get(issueId)?.id,
    get: (id) => byId.get(id),
    add: (c) =>
      insert.run(c.id, c.issue_id, c.customer, c.shop, c.codes, c.festival, c.draw_label, c.png, c.width, c.height, c.created_at),
  }
}

function fileStore() {
  const dir = join(DATA_DIR, 'coupons')
  mkdirSync(dir, { recursive: true })
  const issues = new Map()
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue
    try {
      const meta = JSON.parse(readFileSync(join(dir, name), 'utf8'))
      issues.set(meta.issue_id, meta.id)
    } catch {
      // skip a damaged file
    }
  }
  // Write to a temp file and rename, so a crash never leaves half a coupon.
  const save = (path, data) => {
    writeFileSync(`${path}.tmp`, data)
    renameSync(`${path}.tmp`, path)
  }
  return {
    kind: `files in ${dir}`,
    docsLoad: (col) => {
      const d = join(DATA_DIR, 'docs', col)
      mkdirSync(d, { recursive: true })
      return readdirSync(d)
        .filter((n) => n.endsWith('.json'))
        .map((n) => {
          try {
            return JSON.parse(readFileSync(join(d, n), 'utf8'))
          } catch {
            return null
          }
        })
        .filter(Boolean)
    },
    docPut: (col, id, doc) => {
      mkdirSync(join(DATA_DIR, 'docs', col), { recursive: true })
      save(join(DATA_DIR, 'docs', col, `${id}.json`), JSON.stringify(doc))
    },
    docDelete: (col, id) => {
      try {
        unlinkSync(join(DATA_DIR, 'docs', col, `${id}.json`))
      } catch {
        // already gone
      }
    },
    idForIssue: (issueId) => issues.get(issueId),
    get: (id) => {
      try {
        const meta = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8'))
        return { ...meta, png: readFileSync(join(dir, `${id}.png`)) }
      } catch {
        return undefined
      }
    },
    add: (c) => {
      const { png, ...meta } = c
      save(join(dir, `${c.id}.png`), png)
      save(join(dir, `${c.id}.json`), JSON.stringify(meta))
      issues.set(c.issue_id, c.id)
    },
  }
}

// ---------- helpers ----------

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const linkFor = (id) => `${PUBLIC_URL}/c/${id}`
const fileNameFor = (codes) => `dubai-mall-coupon-${codes[0] ?? 'voucher'}.png`

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...headers })
  res.end(body)
}

const sendJson = (res, status, data, headers) =>
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', ...headers })

function corsHeaders(req) {
  const origin = (req.headers.origin || '').replace(/\/+$/, '')
  if (!DESK_ORIGINS.includes(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Too large'), { status: 413 }))
        req.destroy()
      } else chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/** Checks a coupon upload and returns the image + labels, or throws with a 400 message. */
function parseCoupon(data) {
  const issueId = text(data.issueId, 64, 'issueId')
  const shop = text(data.shop, 120, 'shop')
  const festival = text(data.festival, 120, 'festival')
  const drawLabel = text(data.drawLabel, 160, 'drawLabel')
  const prefix = 'data:image/png;base64,'
  if (typeof data.image !== 'string' || !data.image.startsWith(prefix)) throw bad('Image must be a PNG data URL')
  const png = Buffer.from(data.image.slice(prefix.length), 'base64')
  if (png.length < 33 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) throw bad('Image is not a PNG')
  // Width and height live in the PNG header (IHDR); used for the page and the WhatsApp preview.
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  if (!width || !height || width > 5000 || height > 20000) throw bad('Unexpected image size')
  return { issueId, shop, festival, drawLabel, png, width, height }
}

// ---------- desk data: users, sessions, vouchers, sponsors ----------
// Kept in memory for speed and written through to the store (SQLite table "docs", or JSON files).

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status })
const text = (v, max, name, { optional = false } = {}) => {
  if (optional && (v === undefined || v === null || v === '')) return ''
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw bad(`Invalid ${name}`)
  return v.trim()
}
const SAFE_ID = /^[A-Za-z0-9_.-]{1,80}$/
const SHOP_ID = /^[a-z0-9][a-z0-9-]{1,39}$/
const USERNAME = /^[a-z0-9][a-z0-9._-]{1,39}$/

const docs = {}
for (const col of ['users', 'sessions', 'issues', 'sponsors', 'sponsorLib']) {
  docs[col] = new Map(store.docsLoad(col).map((d) => [d.id, d]))
}
function putDoc(col, doc) {
  if (!SAFE_ID.test(doc.id)) throw new Error(`Unsafe id for ${col}: ${doc.id}`)
  docs[col].set(doc.id, doc)
  store.docPut(col, doc.id, doc)
}
function deleteDoc(col, id) {
  docs[col].delete(id)
  store.docDelete(col, id)
}

// --- passwords (scrypt, built into Node) ---
const scrypt = (password, salt) =>
  new Promise((resolve, reject) =>
    scryptCallback(password, salt, 32, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key))),
  )
async function hashPassword(password) {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString('base64')}$${(await scrypt(password, salt)).toString('base64')}`
}
async function passwordMatches(password, stored) {
  const [kind, salt, hash] = String(stored ?? '').split('$')
  // Unknown users still pay for one scrypt, so response time doesn't reveal who exists.
  const key = await scrypt(String(password), kind === 'scrypt' ? Buffer.from(salt, 'base64') : 'no-user')
  if (kind !== 'scrypt') return false
  const want = Buffer.from(hash, 'base64')
  return key.length === want.length && timingSafeEqual(key, want)
}
const checkNewPassword = (pw) => {
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 200) throw bad('Password must be at least 8 characters')
  return pw
}

// --- sessions (random token; only its SHA-256 is stored) ---
const tokenId = (token) => createHash('sha256').update(token).digest('hex')
function startSession(user) {
  const token = randomBytes(24).toString('base64url')
  putDoc('sessions', { id: tokenId(token), userId: user.id, expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5).toISOString() })
  return token
}
function sessionOf(req) {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec(req.headers.authorization || '')
  if (!m) return null
  const session = docs.sessions.get(tokenId(m[1]))
  if (!session || session.expiresAt < new Date().toISOString()) return null
  const user = docs.users.get(session.userId)
  return user ? { session, user } : null
}
function endSessionsOf(userId, keepSessionId) {
  for (const s of [...docs.sessions.values()]) if (s.userId === userId && s.id !== keepSessionId) deleteDoc('sessions', s.id)
}
function purgeSessions() {
  const now = new Date().toISOString()
  for (const s of [...docs.sessions.values()]) if (s.expiresAt < now) deleteDoc('sessions', s.id)
}
purgeSessions()

// --- login throttling: 10 wrong passwords per username + address, then wait 15 minutes ---
const failures = new Map()
const throttleKey = (req, username) => `${req.headers['x-forwarded-for'] || req.socket.remoteAddress}|${username}`
function throttled(key) {
  const f = failures.get(key)
  return Boolean(f && f.count >= 10 && f.until > Date.now())
}
function noteFailure(key) {
  const f = failures.get(key)
  if (!f || f.until < Date.now()) failures.set(key, { count: 1, until: Date.now() + 15 * 60 * 1000 })
  else f.count++
}

const publicUser = (u) => ({ username: u.id, role: u.role, shopId: u.shopId ?? null })
const canSeeShop = (user, shopId) => user.role === 'admin' || user.shopId === shopId

// --- vouchers ---
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function newCodes(count) {
  const taken = new Set()
  for (const i of docs.issues.values()) for (const c of i.codes) taken.add(c)
  const codes = []
  while (codes.length < count) {
    let body = ''
    for (const b of randomBytes(6)) body += CODE_CHARS[b % CODE_CHARS.length]
    const code = `DME-${body}`
    if (!taken.has(code)) {
      taken.add(code)
      codes.push(code)
    }
  }
  return codes
}
/** The sponsors (logo + name) referenced by these vouchers, for drawing their coupons. */
function sponsorsUsedBy(issues) {
  const used = {}
  for (const i of issues) for (const id of i.sponsorIds ?? []) if (docs.sponsorLib.has(id)) used[id] = docs.sponsorLib.get(id)
  return used
}

// --- sponsors (each shop keeps its own list) ---
const MAX_SPONSORS = 12
const MAX_LOGO_BYTES = 400 * 1024
function parseSponsors(list) {
  if (!Array.isArray(list) || list.length > MAX_SPONSORS) throw bad(`Up to ${MAX_SPONSORS} sponsors`)
  return list.map((s) => {
    const name = text(s?.name, 60, 'sponsor name')
    const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(s?.image ?? ''))
    if (!m || Buffer.byteLength(m[2], 'base64') > MAX_LOGO_BYTES) throw bad(`The logo for "${name}" must be an image under 400 KB`)
    const id = `sp-${createHash('sha256').update(`${name}\n${s.image}`).digest('hex').slice(0, 20)}`
    return { id, name, image: s.image }
  })
}

const readJson = async (req) => {
  try {
    return JSON.parse((await readBody(req)).toString('utf8') || '{}')
  } catch (err) {
    if (err.status) throw err
    throw bad('Body must be JSON')
  }
}

// ---------- API ----------

async function api(req, url, reply) {
  const { pathname: path } = url
  const method = req.method

  if (method === 'POST' && path === '/api/login') {
    const body = await readJson(req)
    const username = String(body.username ?? '').trim().toLowerCase()
    const key = throttleKey(req, username)
    if (throttled(key)) return reply(429, { error: 'Too many wrong passwords. Try again in 15 minutes.' })
    const user = docs.users.get(username)
    if (!(await passwordMatches(String(body.password ?? ''), user?.hash)) || !user) {
      noteFailure(key)
      return reply(401, { error: 'Wrong username or password' })
    }
    failures.delete(key)
    putDoc('users', { ...user, lastLoginAt: new Date().toISOString() })
    return reply(200, { token: startSession(user), user: publicUser(user) })
  }

  const auth = sessionOf(req)
  if (!auth) return reply(401, { error: 'Please log in again' })
  const { user, session } = auth
  const admin = user.role === 'admin'

  if (method === 'POST' && path === '/api/logout') {
    deleteDoc('sessions', session.id)
    return reply(200, { ok: true })
  }
  if (method === 'GET' && path === '/api/me') return reply(200, { user: publicUser(user) })

  // Vouchers: a shop sees only its own; the admin sees all.
  if (method === 'GET' && path === '/api/issues') {
    const issues = [...docs.issues.values()]
      .filter((i) => canSeeShop(user, i.shopId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return reply(200, { issues, sponsors: sponsorsUsedBy(issues) })
  }

  if (method === 'POST' && path === '/api/issues') {
    const body = await readJson(req)
    const shopId = admin ? text(body.shopId, 40, 'shop') : user.shopId
    if (!SHOP_ID.test(shopId)) throw bad('Invalid shop')
    const phone = String(body.phone ?? '')
    if (!/^[6-9]\d{9}$/.test(phone)) throw bad('Invalid WhatsApp number')
    const count = Number(body.count)
    if (!Number.isInteger(count) || count < 1 || count > MAX_CODES) throw bad('Invalid number of vouchers')
    // The voucher remembers the shop's sponsors at this moment, so later changes don't alter it.
    const sponsors = docs.sponsors.get(shopId)?.list ?? []
    const issue = {
      id: `iss-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`,
      createdAt: new Date().toISOString(),
      shopId,
      customerName: text(body.customerName, 100, 'customer name'),
      phone,
      place: text(body.place, 60, 'place', { optional: true }) || '—',
      billNo: text(body.billNo, 40, 'bill number', { optional: true }),
      codes: newCodes(count),
      status: 'pending',
      issuedBy: user.id,
      ...(sponsors.length ? { sponsorIds: sponsors.map((s) => s.id) } : {}),
    }
    putDoc('issues', issue)
    console.log(`voucher ${issue.id} · ${shopId} · ${count} code(s) by ${user.id}`)
    return reply(201, { issue, sponsors: sponsorsUsedBy([issue]) })
  }

  const sentRoute = /^\/api\/issues\/([A-Za-z0-9_-]{1,80})\/sent$/.exec(path)
  if (method === 'POST' && sentRoute) {
    const issue = docs.issues.get(sentRoute[1])
    if (!issue || !canSeeShop(user, issue.shopId)) return reply(404, { error: 'Voucher not found' })
    const updated = { ...issue, status: 'sent', sentAt: new Date().toISOString() }
    putDoc('issues', updated)
    return reply(200, { issue: updated })
  }

  // Sponsors: each shop manages its own list; the admin can manage any shop's.
  if (path === '/api/sponsors' && (method === 'GET' || method === 'PUT')) {
    const body = method === 'PUT' ? await readJson(req) : {}
    const shopId = admin ? String((method === 'PUT' ? body.shopId : url.searchParams.get('shop')) ?? '') : user.shopId
    if (!SHOP_ID.test(shopId)) throw bad('Invalid shop')
    if (method === 'GET') return reply(200, { sponsors: docs.sponsors.get(shopId)?.list ?? [] })
    const list = parseSponsors(body.sponsors)
    for (const s of list) if (!docs.sponsorLib.has(s.id)) putDoc('sponsorLib', s)
    putDoc('sponsors', { id: shopId, list, updatedAt: new Date().toISOString(), updatedBy: user.id })
    return reply(200, { sponsors: list })
  }

  // Logins: the admin creates, resets and removes them.
  if (method === 'GET' && path === '/api/users') {
    if (!admin) return reply(403, { error: 'Only the mall admin can manage logins' })
    const users = [...docs.users.values()].map((u) => ({
      ...publicUser(u),
      lastLoginAt: u.lastLoginAt ?? null,
      passwordSetAt: u.passwordSetAt ?? null,
    }))
    return reply(200, { users })
  }

  const userRoute = /^\/api\/users\/([^/]+)$/.exec(path)
  if (userRoute && (method === 'PUT' || method === 'DELETE')) {
    if (!admin) return reply(403, { error: 'Only the mall admin can manage logins' })
    const username = decodeURIComponent(userRoute[1]).toLowerCase()
    if (!USERNAME.test(username)) throw bad('Usernames use lowercase letters, numbers, dot, dash or underscore')
    const existing = docs.users.get(username)
    if (method === 'DELETE') {
      if (!existing) return reply(404, { error: 'No such login' })
      if (existing.role === 'admin') throw bad('Admin logins are removed from the server command line')
      deleteDoc('users', username)
      endSessionsOf(username)
      return reply(200, { ok: true })
    }
    const body = await readJson(req)
    const password = checkNewPassword(body.password)
    // New logins created here are shop logins: the username is the shop's id.
    if (!existing && !SHOP_ID.test(username)) throw bad('Invalid shop')
    const updated = {
      ...(existing ?? { id: username, role: 'shop', shopId: username, createdAt: new Date().toISOString() }),
      hash: await hashPassword(password),
      passwordSetAt: new Date().toISOString(),
    }
    putDoc('users', updated)
    endSessionsOf(username, session.id) // a new password signs that login out everywhere else
    return reply(200, { user: publicUser(updated) })
  }

  if (method === 'POST' && path === '/api/coupons') {
    const coupon = parseCoupon(await readJson(req))
    const issue = docs.issues.get(coupon.issueId)
    if (!issue || !canSeeShop(user, issue.shopId)) return reply(404, { error: 'Voucher not found' })
    // Sending again for the same purchase reuses its link.
    const existing = store.idForIssue(issue.id)
    if (existing) return reply(200, { id: existing, url: linkFor(existing) })
    const id = randomBytes(9).toString('base64url') // 12 characters, unguessable
    store.add({
      id,
      issue_id: issue.id,
      customer: issue.customerName,
      shop: coupon.shop,
      codes: JSON.stringify(issue.codes),
      festival: coupon.festival,
      draw_label: coupon.drawLabel,
      png: coupon.png,
      width: coupon.width,
      height: coupon.height,
      created_at: new Date().toISOString(),
    })
    putDoc('issues', { ...issue, couponUrl: linkFor(id) })
    console.log(`coupon ${id} saved · ${issue.customerName} · ${issue.codes.length} code(s)`)
    return reply(201, { id, url: linkFor(id) })
  }

  return reply(404, { error: 'Not found' })
}

// ---------- command line: set a password (used by deploy.sh for the admin login) ----------
//   echo 'the-password' | node index.mjs set-password <username> --admin
//   echo 'the-password' | node index.mjs set-password <shop-id>
async function setPasswordCommand(args) {
  const username = String(args[0] ?? '').toLowerCase()
  const role = args.includes('--admin') ? 'admin' : 'shop'
  if (!USERNAME.test(username) || (role === 'shop' && !SHOP_ID.test(username))) {
    console.error('Usage: echo PASSWORD | node index.mjs set-password <username> [--admin]')
    process.exit(2)
  }
  let input = process.env.DME_NEW_PASSWORD
  if (input === undefined) {
    input = ''
    process.stdin.setEncoding('utf8')
    for await (const chunk of process.stdin) input += chunk
  }
  const password = checkNewPassword(input.replace(/\r?\n$/, ''))
  const existing = docs.users.get(username)
  putDoc('users', {
    ...(existing ?? { id: username, createdAt: new Date().toISOString() }),
    role,
    ...(role === 'shop' ? { shopId: username } : { shopId: undefined }),
    hash: await hashPassword(password),
    passwordSetAt: new Date().toISOString(),
  })
  endSessionsOf(username)
  console.log(`Password set for ${role} login "${username}".`)
}

// ---------- coupon page ----------

function couponPage(c) {
  const codes = JSON.parse(c.codes)
  const n = codes.length
  const title = 'Your lucky-draw coupon — Dubai Mall Edakkara'
  const description = `${n} lucky-draw voucher${n === 1 ? '' : 's'} for ${c.customer}. Tap to view and download your coupon.`
  const image = `${linkFor(c.id)}.png`
  const file = fileNameFor(codes)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0E1838">
<title>${escapeHtml(title)}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="Dubai Mall Edakkara">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(linkFor(c.id))}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="${c.width}">
<meta property="og:image:height" content="${c.height}">
<meta property="og:image:alt" content="Lucky-draw coupon">
<meta name="twitter:card" content="summary_large_image">
<style>
  :root { --ink: #0e1838; --gold: #e9b949; --gold-text: #7a520c; --ivory: #faf7f2; --muted: #565d73; --line: #e3ddd2; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--ivory); color: var(--ink); font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  header { background: var(--ink); color: #fff; padding: 20px 16px 56px; text-align: center; }
  .eyebrow { margin: 0; color: var(--gold); font-size: 12px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
  h1 { margin: 6px auto 0; max-width: 560px; font: 600 clamp(22px, 6vw, 30px)/1.25 Georgia, "Times New Roman", serif; }
  .sub { margin: 6px auto 0; max-width: 560px; color: rgb(255 255 255 / .75); font-size: 15px; }
  main { max-width: 640px; margin: -40px auto 0; padding: 0 16px 40px; }
  .card { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 12px; box-shadow: 0 14px 36px -12px rgb(14 24 56 / .3); }
  .card img { display: block; width: 100%; height: auto; border-radius: 10px; }
  .btn { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; margin-top: 16px; border-radius: 14px;
         background: var(--gold); color: var(--ink); font-weight: 800; font-size: 17px; text-decoration: none; }
  .btn:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
  .hint { margin: 10px 0 0; color: var(--muted); font-size: 14px; text-align: center; }
  h2 { margin: 28px 0 8px; font-size: 13px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
  ul { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
  li { padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; background: #fff; font: 700 15px/1.2 ui-monospace, Consolas, monospace; letter-spacing: .08em; }
  .draw { margin: 20px 0 0; padding: 12px 14px; border-radius: 12px; background: #f7ead0; color: var(--gold-text); font-weight: 700; }
  footer { margin-top: 28px; color: var(--muted); font-size: 13px; text-align: center; }
</style>
</head>
<body>
<header>
  <p class="eyebrow">Dubai Mall Edakkara</p>
  <h1>Merry Christmas &amp; Happy New Year, ${escapeHtml(c.customer)}!</h1>
  <p class="sub">Your ${escapeHtml(c.festival)} lucky-draw coupon from ${escapeHtml(c.shop)}.</p>
</header>
<main>
  <div class="card">
    <img src="/c/${c.id}.png" width="${c.width}" height="${c.height}" alt="Lucky-draw coupon with voucher code${n === 1 ? '' : 's'} ${escapeHtml(codes.join(', '))}">
  </div>
  <a class="btn" href="/c/${c.id}.png?download" download="${escapeHtml(file)}">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m0 0l-5-5m5 5l5-5M4 21h16"/></svg>
    Download coupon
  </a>
  <p class="hint">Or press and hold the coupon to save it to your photos.</p>
  <h2>Your voucher code${n === 1 ? '' : 's'}</h2>
  <ul>${codes.map((code) => `<li>${escapeHtml(code)}</li>`).join('')}</ul>
  <p class="draw">${escapeHtml(c.draw_label)}. Keep this coupon to claim your prize.</p>
  <footer>Wishing you and your family a joyful season! — Dubai Mall Edakkara</footer>
</main>
</body>
</html>`
}

const notFoundPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Coupon not found</title></head>
<body style="font:16px/1.5 system-ui,sans-serif;margin:0;padding:48px 16px;text-align:center;background:#faf7f2;color:#0e1838">
<h1 style="font:600 24px Georgia,serif">Coupon not found</h1><p>Please check the link in your WhatsApp message, or ask at the Dubai Mall Edakkara counter.</p></body></html>`

const PAGE_CSP = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

// ---------- routes ----------

const couponRoute = new RegExp(`^/c/(${ID_PATTERN})(\\.png)?$`)

async function handle(req, res) {
  const url = new URL(req.url ?? '/', 'http://local')

  if (url.pathname.startsWith('/api/')) {
    const cors = corsHeaders(req)
    if (req.method === 'OPTIONS') return send(res, 204, '', cors)
    return api(req, url, (status, data) => sendJson(res, status, data, cors))
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed')

  if (url.pathname === '/healthz') return sendJson(res, 200, { ok: true })

  const match = couponRoute.exec(url.pathname)
  if (match) {
    const coupon = store.get(match[1])
    if (!coupon) return send(res, 404, notFoundPage, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': PAGE_CSP })
    if (match[2]) {
      const headers = {
        'Content-Type': 'image/png',
        'Content-Length': String(coupon.png.byteLength),
        // A coupon never changes once saved.
        'Cache-Control': 'public, max-age=31536000, immutable',
      }
      if (url.searchParams.has('download')) {
        headers['Content-Disposition'] = `attachment; filename="${fileNameFor(JSON.parse(coupon.codes))}"`
      }
      return send(res, 200, req.method === 'HEAD' ? '' : Buffer.from(coupon.png), headers)
    }
    return send(res, 200, couponPage(coupon), {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Content-Security-Policy': PAGE_CSP,
    })
  }

  return send(res, 404, notFoundPage, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': PAGE_CSP })
}

const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    const status = err.status ?? 500
    if (status === 500) console.error(err)
    if (!res.headersSent) sendJson(res, status, { error: status === 500 ? 'Server error' : err.message }, corsHeaders(req))
  })
})

if (process.argv[2] === 'set-password') {
  await setPasswordCommand(process.argv.slice(3))
} else if (process.argv[2] === 'has-admin') {
  // exit code 0 when an admin login exists (deploy.sh asks for one only when there's none)
  process.exitCode = [...docs.users.values()].some((u) => u.role === 'admin') ? 0 : 1
} else {
  server.listen(PORT, HOST, () => {
    console.log(`Coupon server listening on ${HOST}:${PORT}`)
    console.log(`Coupon links will look like ${PUBLIC_URL}/c/<id>`)
    console.log(`Desk allowed from: ${DESK_ORIGINS.join(', ')}`)
    console.log(`Data stored as ${store.kind}`)
    const admins = [...docs.users.values()].filter((u) => u.role === 'admin')
    if (!admins.length) console.log('No admin login yet: node index.mjs set-password <username> --admin')
  })
  setInterval(purgeSessions, 60 * 60 * 1000).unref()
}
