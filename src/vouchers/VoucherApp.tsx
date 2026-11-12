import type { GridApi } from 'ag-grid-community'
import { ArrowLeft, Copy, Download, ExternalLink, RotateCcw, Search, Store, Ticket } from 'lucide-react'
import { useCallback, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { WhatsAppIcon } from '../components/ShopCard'
import { festival } from '../data/festival'
import {
  allCodes,
  eligibleVouchers,
  inr,
  makeCode,
  places,
  RUPEES_PER_VOUCHER,
  shopById,
  shopRows,
  useIssues,
  voucherMessage,
  whatsappUrl,
  type Issue,
  type WhatsAppTarget,
} from './data'
import { PurchaseGrid, ShopGrid, VoucherGrid } from './grids'

type Tab = 'vouchers' | 'purchases' | 'shops'

/** Accepts "98470 12345", "+91 9847012345", "09847012345" … returns the 10-digit mobile or null. */
function normalisePhone(raw: string) {
  let d = raw.replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return /^[6-9]\d{9}$/.test(d) ? d : null
}

/** Opens WhatsApp in one reused tab so staff don't pile up a tab per customer. */
const openWhatsApp = (issue: Issue, target: WhatsAppTarget) =>
  window.open(whatsappUrl(issue, target), 'dme-whatsapp') !== null

export function VoucherApp() {
  const { issues, add, markSent, reset } = useIssues()
  const [target, setTarget] = useState<WhatsAppTarget>('web')
  const [last, setLast] = useState<Issue | null>(null)
  const [tab, setTab] = useState<Tab>('vouchers')
  const [search, setSearch] = useState('')
  const gridApi = useRef<GridApi | null>(null)

  const stats = useMemo(() => {
    const vouchers = issues.reduce((n, i) => n + i.codes.length, 0)
    const customers = new Set(issues.map((i) => i.phone)).size
    const shops = new Set(issues.map((i) => i.shopId)).size
    const pending = issues.filter((i) => i.status === 'pending').length
    return { vouchers, customers, shops, pending, purchases: issues.length }
  }, [issues])

  const issue = (draft: Omit<Issue, 'id' | 'createdAt' | 'codes' | 'status'>, count: number) => {
    const taken = allCodes(issues)
    const created: Issue = {
      ...draft,
      id: `iss-${Date.now()}`,
      createdAt: new Date().toISOString(),
      codes: Array.from({ length: count }, () => makeCode(taken)),
      status: 'pending',
    }
    const opened = openWhatsApp(created, target)
    const saved = opened ? { ...created, status: 'sent' as const, sentAt: new Date().toISOString() } : created
    add(saved)
    setLast(saved)
  }

  const resend = useCallback(
    (i: Issue) => {
      if (openWhatsApp(i, target)) {
        markSent(i.id)
        setLast({ ...i, status: 'sent' })
      }
    },
    [target, markSent],
  )

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'vouchers', label: 'Vouchers', count: stats.vouchers },
    { id: 'purchases', label: 'Customers', count: stats.purchases },
    { id: 'shops', label: 'Shop-wise', count: shopRows.length },
  ]

  return (
    <div className="min-h-screen">
      <header className="arch-pattern bg-ink text-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-gold text-ink">
              <Ticket className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold leading-tight">Voucher desk</h1>
              <p className="text-sm text-white/70">
                Dubai Mall Edakkara · {festival.name} · {festival.dateLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gold sm:inline">
              Mock data
            </span>
            <button
              type="button"
              onClick={() => {
                if (confirm('Replace all vouchers with fresh demo data?')) {
                  reset()
                  setLast(null)
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10"
            >
              <RotateCcw className="size-4" /> Reset demo
            </button>
            <a href="/" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white/80 hover:text-white">
              <ArrowLeft className="size-4" /> Mall site
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
        <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Vouchers issued" value={stats.vouchers.toLocaleString('en-IN')} />
          <Stat label="Customers" value={stats.customers.toLocaleString('en-IN')} />
          <Stat label="Shops issuing" value={`${stats.shops} / ${shopRows.length}`} />
          <Stat label="Not yet sent" value={String(stats.pending)} tone={stats.pending ? 'warn' : undefined} />
        </section>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <IssueForm target={target} onTarget={setTarget} onIssue={issue} />
          <LastIssued issue={last} onResend={resend} />
        </div>

        <section aria-label="Records" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" className="flex rounded-xl bg-sand p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                    tab === t.id ? 'bg-white text-ink shadow-card' : 'text-muted hover:text-ink'
                  }`}
                >
                  {t.label} <span className="ml-1 text-xs font-semibold text-muted">{t.count}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-1 items-center justify-end gap-2">
              <label className="relative w-full max-w-xs">
                <span className="sr-only">Search records</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search code, customer, shop…"
                  className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-gold focus:shadow-focus-gold"
                />
              </label>
              <button
                type="button"
                onClick={() => gridApi.current?.exportDataAsCsv({ fileName: `dme-${tab}.csv` })}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-sand"
              >
                <Download className="size-4" /> CSV
              </button>
            </div>
          </div>

          {tab === 'vouchers' && <VoucherGrid issues={issues} search={search} onReady={(api) => (gridApi.current = api)} />}
          {tab === 'purchases' && (
            <PurchaseGrid issues={issues} search={search} onReady={(api) => (gridApi.current = api)} onSend={resend} />
          )}
          {tab === 'shops' && <ShopGrid issues={issues} search={search} onReady={(api) => (gridApi.current = api)} />}
        </section>
      </main>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${tone === 'warn' ? 'text-gold-text' : 'text-ink'}`}>{value}</p>
    </div>
  )
}

// ---------- form ----------

function IssueForm({
  target,
  onTarget,
  onIssue,
}: {
  target: WhatsAppTarget
  onTarget: (t: WhatsAppTarget) => void
  onIssue: (draft: Omit<Issue, 'id' | 'createdAt' | 'codes' | 'status'>, count: number) => void
}) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [place, setPlace] = useState('')
  const [shopId, setShopId] = useState('')
  const [billNo, setBillNo] = useState('')
  const [amount, setAmount] = useState('')
  const [count, setCount] = useState(0)
  const [tried, setTried] = useState(false)

  const amt = Number(amount)
  const eligible = eligibleVouchers(amt)
  const shop = shopId ? shopById[shopId] : undefined
  const normalised = normalisePhone(phone)

  const errors = {
    phone: !normalised && 'Enter a 10-digit Indian mobile number',
    name: !name.trim() && 'Enter the customer name',
    shop: !shop && 'Pick the shop the customer bought from',
    amount: eligible === 0 && `Bill must be at least ${inr(RUPEES_PER_VOUCHER)} to earn a voucher`,
    count: (count < 1 || count > eligible) && eligible > 0 && `Choose between 1 and ${eligible}`,
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    onIssue(
      { phone: normalised!, customerName: name.trim(), place: place.trim() || '—', shopId, billNo: billNo.trim() },
      count,
    )
    // Keep the shop: the counter usually issues several in a row for the same shop.
    setPhone('')
    setName('')
    setPlace('')
    setBillNo('')
    setAmount('')
    setCount(0)
    setTried(false)
  }

  const err = (k: keyof typeof errors) => (tried && errors[k] ? errors[k] : null)

  return (
    <form onSubmit={submit} noValidate className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
      <h2 className="text-xl font-semibold text-ink">Issue vouchers</h2>
      <p className="mt-1 text-sm text-muted">
        1 voucher for every {inr(RUPEES_PER_VOUCHER)} on the bill. Vouchers open in WhatsApp, ready to send.
      </p>

      <div className="mt-5 space-y-4">
        <Field label="Customer WhatsApp number" error={err('phone')}>
          <div className="flex rounded-lg border border-line focus-within:border-gold focus-within:shadow-focus-gold">
            <span className="grid place-items-center border-r border-line bg-sand px-3 text-sm font-semibold text-muted">+91</span>
            <input
              inputMode="tel"
              autoComplete="off"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98470 12345"
              className="w-full rounded-r-lg px-3 py-2.5 outline-none"
            />
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer name" error={err('name')}>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Customer place">
            <input value={place} onChange={(e) => setPlace(e.target.value)} list="dme-places" placeholder="Edakkara" className={inputCls} />
            <datalist id="dme-places">
              {places.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
        </div>

        <Field label="Shop (purchased from)" error={err('shop')}>
          <select value={shopId} onChange={(e) => setShopId(e.target.value)} className={inputCls}>
            <option value="">Select shop number…</option>
            {shopRows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.shopNo} · {s.name} — {s.categoryLabel}
              </option>
            ))}
          </select>
          {shop && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
              <Store className="size-3.5" /> {shop.location} · {shop.owner}
            </p>
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bill amount (₹) · not saved" error={err('amount')}>
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, '')
                setAmount(v)
                setCount(eligibleVouchers(Number(v)))
              }}
              placeholder="4500"
              className={inputCls}
            />
          </Field>
          <Field label="Bill number">
            <input value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="Optional" className={inputCls} />
          </Field>
        </div>

        <Field label="Number of vouchers" error={err('count')}>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={eligible ? 1 : 0}
              max={eligible}
              disabled={eligible === 0}
              value={eligible ? count : ''}
              onChange={(e) => setCount(Math.floor(Number(e.target.value)))}
              className={`${inputCls.replace('w-full', 'w-28')} disabled:bg-sand`}
            />
            <span className="text-sm text-muted">
              {eligible ? (
                <>
                  Eligible for <b className="text-ink">{eligible}</b>
                </>
              ) : (
                `Enter amount (min ${inr(RUPEES_PER_VOUCHER)})`
              )}
            </span>
          </div>
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-ink">Open in</legend>
          <div className="inline-flex rounded-lg bg-sand p-1">
            {(['web', 'app'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={target === t}
                onClick={() => onTarget(t)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${target === t ? 'bg-white text-ink shadow-card' : 'text-muted'}`}
              >
                {t === 'web' ? 'WhatsApp Web' : 'WhatsApp app'}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <button
        type="submit"
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 py-3 font-bold text-white transition-colors hover:bg-whatsapp-hover"
      >
        <WhatsAppIcon className="size-5" />
        Generate {count > 0 && eligible > 0 ? `${count} ` : ''}voucher{count === 1 ? '' : 's'} & open WhatsApp
      </button>
    </form>
  )
}

const inputCls =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 outline-none focus:border-gold focus:shadow-focus-gold'

function Field({ label, error, children }: { label: string; error?: string | false | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs font-semibold text-crimson">{error}</span>}
    </label>
  )
}

// ---------- preview ----------

function LastIssued({ issue, onResend }: { issue: Issue | null; onResend: (i: Issue) => void }) {
  const [copied, setCopied] = useState(false)

  if (!issue) {
    return (
      <section className="flex flex-col justify-center rounded-2xl border border-dashed border-line bg-white/60 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-ink">How it works</h2>
        <ol className="mt-4 space-y-3 text-sm text-muted">
          {[
            'Customer shares their WhatsApp number at the counter.',
            `Pick the shop and enter the bill amount — every ${inr(RUPEES_PER_VOUCHER)} earns one voucher.`,
            'Unique voucher codes are generated and WhatsApp opens with the message ready for that number.',
            'Press Send in WhatsApp. The voucher shows as Sent in the records below.',
          ].map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gold-soft text-xs font-bold text-gold-text">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </section>
    )
  }

  const shop = shopById[issue.shopId]
  const shown = issue.codes.slice(0, 12)
  const message = voucherMessage(issue)

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-pine">Just issued</p>
          <h2 className="text-xl font-semibold text-ink">
            {issue.codes.length} voucher{issue.codes.length === 1 ? '' : 's'} for {issue.customerName}
          </h2>
          <p className="text-sm text-muted">
            +91 {issue.phone.slice(0, 5)} {issue.phone.slice(5)} · {shop.shopNo} {shop.name}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(message)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              } catch {
                // clipboard blocked — nothing to do
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-sand"
          >
            <Copy className="size-4" /> {copied ? 'Copied' : 'Copy text'}
          </button>
          <button
            type="button"
            onClick={() => onResend(issue)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-whatsapp px-3 py-2 text-sm font-bold text-white hover:bg-whatsapp-hover"
          >
            <ExternalLink className="size-4" /> Open again
          </button>
        </div>
      </div>

      {issue.status === 'pending' && (
        <p className="mt-3 rounded-lg bg-gold-soft px-3 py-2 text-sm text-gold-text">
          The browser blocked the WhatsApp tab. Allow pop-ups for this page, then press “Open again”.
        </p>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]">
        <ul className="grid content-start gap-3 sm:grid-cols-2">
          {shown.map((code) => (
            <li key={code} className="relative flex overflow-hidden rounded-xl bg-ink text-white">
              <div className="flex-1 p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gold">Lucky draw voucher</p>
                <p className="mt-1 font-mono text-lg font-bold tracking-wider">{code}</p>
                <p className="mt-1 truncate text-xs text-white/60">
                  {shop.name} · {festival.dateLabel}
                </p>
              </div>
              <div className="grid w-12 place-items-center border-l-2 border-dashed border-white/25 bg-gold text-ink">
                <Ticket className="size-5" />
              </div>
            </li>
          ))}
          {issue.codes.length > shown.length && (
            <li className="grid place-items-center rounded-xl border border-dashed border-line p-3 text-sm font-semibold text-muted">
              +{issue.codes.length - shown.length} more in the message
            </li>
          )}
        </ul>

        <div className="rounded-xl bg-[#efeae2] p-3">
          <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wide text-muted">WhatsApp message</p>
          <div className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg rounded-tr-none bg-[#d9fdd3] p-3 text-[13px] leading-snug text-[#111b21] shadow-sm">
            {message.replace(/\*/g, '')}
          </div>
        </div>
      </div>
    </section>
  )
}
