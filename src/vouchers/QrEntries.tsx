import { Minus, Plus, QrCode, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { WhatsAppIcon } from '../components/ShopCard'
import { can, type Entry, type User } from './api'
import { eligibleVouchers, inr, shopById } from './data'

const MAX_RELEASE = 50

const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  return hours < 24 ? `${hours} h ago` : new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

/**
 * Customers who filled in the shop's QR form and were confirmed with the shop code.
 * The shop picks how many vouchers each gets and releases them on WhatsApp.
 */
export function QrEntries({
  user,
  entries,
  error,
  onRelease,
  onDismiss,
}: {
  user: User
  entries: Entry[]
  error: string
  /** Must be called straight from the click, so the WhatsApp tab may open. Returns an error message, or null. */
  onRelease: (entry: Entry, count: number) => Promise<string | null>
  onDismiss: (entry: Entry) => Promise<void>
}) {
  const admin = user.role === 'admin'
  const waiting = entries.filter((e) => e.status === 'new')
  const released = entries.filter((e) => e.status === 'issued').length

  // Re-render the "x min ago" labels every half minute.
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <section aria-labelledby="entries-title" className="rounded-2xl border border-line bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-gold-soft text-gold-text">
            <QrCode className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id="entries-title" className="text-lg font-semibold text-ink">
              Customers from QR{' '}
              {waiting.length > 0 && (
                <span className="ml-1 rounded-full bg-crimson px-2 py-0.5 align-middle text-xs font-bold text-white tabular-nums">
                  {waiting.length}
                </span>
              )}
            </h2>
            <p className="text-xs text-muted">
              Updates by itself · {released} released in the last day
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mx-5 mt-4 rounded-lg bg-crimson-soft px-3 py-2 text-sm font-semibold text-crimson sm:mx-6">
          {error}
        </p>
      )}

      {waiting.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted sm:px-6">
          No one is waiting. When a customer scans {admin ? 'a shop’s' : 'your'} QR, fills in their details and staff enter
          the shop code, they show up here.
        </p>
      ) : (
        <ul className="divide-y divide-line" aria-live="polite">
          {waiting.map((e) => (
            <EntryRow key={e.id} entry={e} admin={admin} canIssue={can(user, 'issue')} onRelease={onRelease} onDismiss={onDismiss} />
          ))}
        </ul>
      )}
    </section>
  )
}

function EntryRow({
  entry,
  admin,
  canIssue,
  onRelease,
  onDismiss,
}: {
  entry: Entry
  admin: boolean
  canIssue: boolean
  onRelease: (entry: Entry, count: number) => Promise<string | null>
  onDismiss: (entry: Entry) => Promise<void>
}) {
  // The bill amount the customer typed sets the count (1 per ₹1,000); staff can still change it.
  const [count, setCount] = useState(() => Math.min(MAX_RELEASE, Math.max(1, eligibleVouchers(entry.billAmount ?? 0))))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const shop = shopById[entry.shopId]
  const valid = Number.isInteger(count) && count >= 1 && count <= MAX_RELEASE

  const release = () => {
    if (!valid || busy) return
    setBusy(true)
    setError('')
    // Called right away (not after an await) so the browser allows the WhatsApp tab.
    void onRelease(entry, count).then((err) => {
      setBusy(false)
      if (err) setError(err)
    })
  }

  const stepBtn =
    'grid size-11 place-items-center text-ink transition-colors hover:bg-sand disabled:cursor-not-allowed disabled:text-muted/50'

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:px-6">
      <div className="min-w-48 flex-1">
        <p className="font-semibold text-ink">{entry.customerName}</p>
        <p className="text-sm text-muted tabular-nums">
          +91 {entry.phone.slice(0, 5)} {entry.phone.slice(5)}
          {entry.place && entry.place !== '—' ? ` · ${entry.place}` : ''}
          {entry.billNo ? ` · Bill ${entry.billNo}` : ''}
          {entry.billAmount ? ` · ${inr(entry.billAmount)}` : ''}
        </p>
        <p className="text-xs text-muted">
          {admin && shop ? `${shop.shopNo} · ${shop.name} · ` : ''}
          {ago(entry.createdAt)}
        </p>
      </div>

      {canIssue ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-lg border border-line" role="group" aria-label={`Vouchers for ${entry.customerName}`}>
            <button type="button" onClick={() => setCount((n) => Math.max(1, n - 1))} disabled={count <= 1} aria-label="One less voucher" className={stepBtn}>
              <Minus className="size-4" aria-hidden />
            </button>
            <input
              type="number"
              min={1}
              max={MAX_RELEASE}
              value={Number.isNaN(count) ? '' : count}
              onChange={(e) => setCount(Math.floor(Number(e.target.value)))}
              aria-label="Number of vouchers"
              className="h-11 w-14 border-x border-line text-center font-semibold tabular-nums outline-none focus:bg-gold-soft/40"
            />
            <button type="button" onClick={() => setCount((n) => Math.min(MAX_RELEASE, n + 1))} disabled={count >= MAX_RELEASE} aria-label="One more voucher" className={stepBtn}>
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            onClick={release}
            disabled={!valid || busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-whatsapp px-4 text-sm font-bold text-white transition-colors hover:bg-whatsapp-hover disabled:opacity-60"
          >
            <WhatsAppIcon className="size-4" />
            {busy ? 'Releasing…' : `Release ${valid ? count : ''} voucher${count === 1 ? '' : 's'}`}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted">This login can’t issue vouchers.</p>
      )}

      <button
        type="button"
        onClick={async () => {
          if (confirm(`Remove ${entry.customerName} from the waiting list? No vouchers are sent.`)) await onDismiss(entry)
        }}
        aria-label={`Remove ${entry.customerName} from the waiting list`}
        className="grid size-11 place-items-center rounded-lg text-muted transition-colors hover:bg-crimson-soft hover:text-crimson"
      >
        <X className="size-4" aria-hidden />
      </button>

      {(error || !valid) && (
        <p role="alert" className="basis-full text-xs font-semibold text-crimson">
          {error || `Choose between 1 and ${MAX_RELEASE} vouchers`}
        </p>
      )}
    </li>
  )
}
