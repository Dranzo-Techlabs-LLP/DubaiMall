import { Copy, Download, Eye, EyeOff, ExternalLink, QrCode, RefreshCw } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { getShopSettings, newShopCode, type ShopSettings, type User } from './api'
import { shopById, shopRows } from './data'

const shopTitle = (shopId: string) => {
  const s = shopById[shopId]
  return s ? `${s.name} (Shop ${s.shopNo})` : shopId
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

/** A printable poster: mall name, shop name, the QR and what to do. */
async function posterPng(qr: string, shopId: string) {
  const W = 900
  const H = 1200
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#faf7f2'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#0e1838'
  ctx.fillRect(0, 0, W, 300)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#e9b949'
  ctx.font = '800 28px system-ui, sans-serif'
  ctx.fillText('DUBAI MALL EDAKKARA · LUCKY DRAW', W / 2, 90)
  ctx.fillStyle = '#ffffff'
  ctx.font = '600 52px Georgia, serif'
  ctx.fillText('Scan for your coupon', W / 2, 170)
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = '600 32px system-ui, sans-serif'
  ctx.fillText(shopTitle(shopId), W / 2, 235)
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(170, 350, 560, 560, 28)
  ctx.fill()
  ctx.drawImage(await loadImage(qr), 190, 370, 520, 520)
  ctx.fillStyle = '#0e1838'
  ctx.font = '700 34px system-ui, sans-serif'
  ctx.fillText('1. Scan  ·  2. Fill in your details', W / 2, 990)
  ctx.fillText('3. Hand your phone to the shop staff', W / 2, 1040)
  ctx.fillStyle = '#565d73'
  ctx.font = '500 26px system-ui, sans-serif'
  ctx.fillText('Your coupon arrives on WhatsApp', W / 2, 1110)
  return canvas.toDataURL('image/png')
}

/** The shop's QR customer form and the counter code staff type to confirm each customer. */
export function ShopQr({ user }: { user: User }) {
  const admin = user.role === 'admin'
  const [shopId, setShopId] = useState(user.shopId ?? '')
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [qr, setQr] = useState('')
  const [error, setError] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    setSettings(null)
    setQr('')
    setShowCode(false)
    if (!shopId) return
    let stale = false
    getShopSettings(shopId, shopTitle(shopId))
      .then(async (s) => {
        const url = await QRCode.toDataURL(s.entryUrl, { width: 640, margin: 1, color: { dark: '#0e1838', light: '#ffffff' } })
        if (stale) return
        setSettings(s)
        setQr(url)
        setError('')
      })
      .catch((err) => !stale && setError(err instanceof Error ? err.message : 'Could not load the QR settings'))
    return () => {
      stale = true
    }
  }, [shopId])

  const flash = (text: string) => {
    setNote(text)
    setTimeout(() => setNote(''), 2000)
  }
  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text)
      flash(done)
    } catch {
      flash('Copying is blocked in this browser')
    }
  }
  const download = async () => {
    if (!qr) return
    const a = document.createElement('a')
    a.href = await posterPng(qr, shopId)
    a.download = `dubai-mall-qr-${shopId}.png`
    a.click()
  }
  const renewCode = async () => {
    if (!confirm('Make a new shop code? The old code stops working straight away.')) return
    try {
      setSettings(await newShopCode(shopId))
      setShowCode(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not make a new code')
    }
  }

  const localAddress = settings && settings.entryUrl.startsWith('http://')
  const btn = 'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-sand'

  return (
    <section aria-labelledby="qr-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="qr-title" className="text-xl font-semibold text-ink">
            {admin ? 'Shop QR codes' : 'Your QR & shop code'}
          </h2>
          <p className="text-sm text-muted">
            Customers scan the QR and type their details on their own phone. Your staff confirm with the shop code, and
            the customer appears in “Customers from QR” above.
          </p>
        </div>
        {admin && (
          <label className="w-full max-w-xs">
            <span className="sr-only">Shop</span>
            <select
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              className="min-h-11 w-full cursor-pointer rounded-lg border border-line bg-white px-3 outline-none focus:border-gold focus:shadow-focus-gold"
            >
              <option value="">Select a shop…</option>
              {shopRows.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shopNo} · {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-crimson-soft px-3 py-2 text-sm font-semibold text-crimson">
          {error}
        </p>
      )}

      {!shopId ? (
        <p className="rounded-2xl border border-dashed border-line bg-white/60 p-8 text-center text-sm text-muted">
          Pick a shop to see its QR code and shop code.
        </p>
      ) : !settings ? (
        <p className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-muted">Loading…</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_1fr]">
          <div className="rounded-2xl border border-line bg-white p-5 text-center shadow-card">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-text">Scan for your coupon</p>
            <p className="mt-1 font-semibold text-ink">{shopTitle(shopId)}</p>
            {qr && <img src={qr} alt={`QR code that opens the customer form for ${shopTitle(shopId)}`} className="mx-auto mt-3 w-full max-w-72" />}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => void download()} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-ink px-4 text-sm font-bold text-white hover:bg-ink-soft">
                <Download className="size-4" aria-hidden /> Download poster
              </button>
              <a href={settings.entryUrl} target="_blank" rel="noreferrer" className={btn}>
                <ExternalLink className="size-4" aria-hidden /> Open form
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <p className="text-sm font-semibold text-muted">Shop code — staff type this on the customer's phone</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="rounded-xl bg-gold-soft px-4 py-2 font-mono text-3xl font-extrabold tracking-[0.3em] text-gold-text tabular-nums">
                  {showCode ? settings.code : '••••••'}
                </p>
                <button type="button" onClick={() => setShowCode((v) => !v)} className={btn} aria-pressed={showCode}>
                  {showCode ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  {showCode ? 'Hide' : 'Show'}
                </button>
                <button type="button" onClick={() => void copy(settings.code, 'Shop code copied')} className={btn}>
                  <Copy className="size-4" aria-hidden /> Copy
                </button>
                <button type="button" onClick={() => void renewCode()} className={btn}>
                  <RefreshCw className="size-4" aria-hidden /> New code
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">
                Keep it with the counter staff only. Make a new code if a customer learns it.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-muted">
                <QrCode className="size-4" aria-hidden /> Form address (inside the QR)
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-sand px-3 py-2 text-sm text-ink">{settings.entryUrl}</code>
                <button type="button" onClick={() => void copy(settings.entryUrl, 'Link copied')} className={btn}>
                  <Copy className="size-4" aria-hidden /> Copy link
                </button>
              </div>
              {localAddress && (
                <p className="mt-2 text-xs text-gold-text">
                  Test address: only phones on the same Wi-Fi as this computer can open it. The live site uses its own https address.
                </p>
              )}
              <p aria-live="polite" className="mt-2 min-h-5 text-xs font-semibold text-pine">
                {note}
              </p>
            </div>

            <ol className="grid gap-2 text-sm text-muted sm:grid-cols-2">
              {[
                'Print the poster and keep it at the billing counter.',
                'The customer scans it and types their name and WhatsApp number.',
                'Staff type the shop code on the customer’s phone and press Submit.',
                'The customer appears above: choose how many vouchers and release them on WhatsApp.',
              ].map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sand text-xs font-bold text-ink">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  )
}
