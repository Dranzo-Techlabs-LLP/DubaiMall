// Coupon link server for the Dubai Mall Edakkara voucher desk.
//
// The desk uploads each coupon image here; the server stores it in SQLite and returns a short
// link (/c/<id>) for the WhatsApp greeting. The link opens a page with the coupon and a Download
// button, and carries Open Graph tags so WhatsApp can show the coupon as a link preview.
//
// Plain Node with no dependencies. Stores coupons in SQLite (node:sqlite, Node 22.13+) when the
// Node version has it, otherwise as files — so it also runs on older Node versions on cPanel.
// Configure with .env next to this file (see .env.example) and start with `npm run server`,
// or on cPanel as a Node.js app with startup file app.js.

import { randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

// Settings from .env next to this file. cPanel starts the app without command-line flags,
// so the server loads it itself. Real environment variables win over the file.
try {
  process.loadEnvFile(join(here, '.env'))
} catch {
  // no .env (or Node older than 20.12): use the real environment variables
}

// ---------- config ----------

const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '0.0.0.0'
/** Shared secret the desk sends in X-Desk-Key. Only the desk may upload coupons. */
const DESK_KEY = process.env.DESK_KEY || ''
const DATA_DIR = process.env.DATA_DIR || join(here, 'data')
/** Pages allowed to call the upload API (the voucher desk). */
const DESK_ORIGINS = (process.env.DESK_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean)
/** Address customers' phones use. Locally: this PC's Wi-Fi address. When hosted: https://your-domain. */
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://${lanAddress()}:${PORT}`).replace(/\/+$/, '')

const MAX_BODY = 4 * 1024 * 1024 // a coupon PNG is ~200 KB; base64 + JSON adds a third
const MAX_CODES = 500
const ID_PATTERN = '[A-Za-z0-9_-]{12}'

if (DESK_KEY.length < 16) {
  console.error('DESK_KEY is missing or too short. Set it in server/.env (see server/.env.example).')
  process.exit(1)
}

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
  const byIssue = db.prepare('select id from coupons where issue_id = ?')
  const byId = db.prepare('select * from coupons where id = ?')
  const insert = db.prepare(`
    insert into coupons (id, issue_id, customer, shop, codes, festival, draw_label, png, width, height, created_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  return {
    kind: `SQLite database ${file}`,
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

function keyMatches(given) {
  const a = Buffer.from(String(given ?? ''))
  const b = Buffer.from(DESK_KEY)
  return a.length === b.length && timingSafeEqual(a, b)
}

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Desk-Key',
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
        reject(Object.assign(new Error('Coupon is too large'), { status: 413 }))
        req.destroy()
      } else chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/** Checks the upload and returns the clean coupon, or throws with a 400 message. */
function parseCoupon(raw) {
  const bad = (msg) => Object.assign(new Error(msg), { status: 400 })
  let data
  try {
    data = JSON.parse(raw.toString('utf8'))
  } catch {
    throw bad('Body must be JSON')
  }
  const text = (v, max, name) => {
    if (typeof v !== 'string' || !v.trim() || v.length > max) throw bad(`Invalid ${name}`)
    return v.trim()
  }
  const issueId = text(data.issueId, 64, 'issueId')
  const customer = text(data.customer, 100, 'customer')
  const shop = text(data.shop, 120, 'shop')
  const festival = text(data.festival, 120, 'festival')
  const drawLabel = text(data.drawLabel, 160, 'drawLabel')
  if (!Array.isArray(data.codes) || !data.codes.length || data.codes.length > MAX_CODES) throw bad('Invalid codes')
  const codes = data.codes.map((c) => {
    if (typeof c !== 'string' || !/^DME-[A-Z0-9]{6}$/.test(c)) throw bad('Invalid voucher code')
    return c
  })
  const prefix = 'data:image/png;base64,'
  if (typeof data.image !== 'string' || !data.image.startsWith(prefix)) throw bad('Image must be a PNG data URL')
  const png = Buffer.from(data.image.slice(prefix.length), 'base64')
  if (png.length < 33 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) throw bad('Image is not a PNG')
  // Width and height live in the PNG header (IHDR); used for the page and the WhatsApp preview.
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  if (!width || !height || width > 5000 || height > 20000) throw bad('Unexpected image size')
  return { issueId, customer, shop, festival, drawLabel, codes, png, width, height }
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

  if (url.pathname === '/api/coupons') {
    const cors = corsHeaders(req)
    if (req.method === 'OPTIONS') return send(res, 204, '', cors)
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' }, cors)
    if (!keyMatches(req.headers['x-desk-key'])) return sendJson(res, 401, { error: 'Wrong desk key' }, cors)
    const coupon = parseCoupon(await readBody(req))
    // Sending again for the same purchase reuses its link.
    const existing = store.idForIssue(coupon.issueId)
    if (existing) return sendJson(res, 200, { id: existing, url: linkFor(existing) }, cors)
    const id = randomBytes(9).toString('base64url') // 12 characters, unguessable
    store.add({
      id,
      issue_id: coupon.issueId,
      customer: coupon.customer,
      shop: coupon.shop,
      codes: JSON.stringify(coupon.codes),
      festival: coupon.festival,
      draw_label: coupon.drawLabel,
      png: coupon.png,
      width: coupon.width,
      height: coupon.height,
      created_at: new Date().toISOString(),
    })
    console.log(`coupon ${id} saved · ${coupon.customer} · ${coupon.codes.length} code(s)`)
    return sendJson(res, 201, { id, url: linkFor(id) }, cors)
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

server.listen(PORT, HOST, () => {
  console.log(`Coupon server listening on ${HOST}:${PORT}`)
  console.log(`Coupon links will look like ${PUBLIC_URL}/c/<id>`)
  console.log(`Desk allowed from: ${DESK_ORIGINS.join(', ')}`)
  console.log(`Coupons stored as ${store.kind}`)
})
