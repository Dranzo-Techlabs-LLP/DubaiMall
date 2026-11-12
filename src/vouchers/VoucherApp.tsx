import type { GridApi } from 'ag-grid-community'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Copy,
  Download,
  ExternalLink,
  ImageDown,
  Link2,
  ImagePlus,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Store,
  Ticket,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { WhatsAppIcon } from '../components/ShopCard'
import { festival } from '../data/festival'
import {
  allCodes,
  eligibleVouchers,
  inr,
  loadActiveSponsors,
  makeCode,
  places,
  rememberSponsors,
  RUPEES_PER_VOUCHER,
  setActiveSponsors,
  shopById,
  sponsorId,
  sponsorImage,
  sponsorsFor,
  shopRows,
  useIssues,
  voucherMessage,
  whatsappUrl,
  type Issue,
  type Sponsor,
  type WhatsAppTarget,
} from './data'
import { Coupon } from './Coupon'
import { PurchaseGrid, ShopGrid, VoucherGrid } from './grids'
import {
  canShareImage,
  copyImage,
  couponFileName,
  couponLinksEnabled,
  downloadImage,
  nodeToPng,
  shareImage,
  uploadCoupon,
} from './share'

/** What the form currently holds — drives the live coupon preview. */
interface Draft {
  customerName: string
  shopId: string
  sponsors: Sponsor[]
  count: number
}
const emptyDraft: Draft = { customerName: '', shopId: '', sponsors: [], count: 0 }

const shopLabel = (shopId: string) => {
  const s = shopById[shopId]
  return s ? `${s.shopNo} · ${s.name}` : ''
}

type Tab = 'vouchers' | 'purchases' | 'shops'

/** Accepts "98470 12345", "+91 9847012345", "09847012345" … returns the 10-digit mobile or null. */
function normalisePhone(raw: string) {
  let d = raw.replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return /^[6-9]\d{9}$/.test(d) ? d : null
}

/** WhatsApp opens in one reused tab so staff don't pile up a tab per customer. */
const WA_WINDOW = 'dme-whatsapp'

/** How the coupon image went out on the last send. */
type SendResult = 'linked' | 'upload-failed' | 'copied' | 'manual'

/** What the coupon server keeps with the image, for the customer's coupon page. */
const couponUpload = (i: Issue) => {
  const shop = shopById[i.shopId]
  return {
    issueId: i.id,
    customer: i.customerName,
    shop: `${shop.name} (Shop ${shop.shopNo})`,
    codes: i.codes,
    festival: festival.name,
    drawLabel: festival.drawLabel,
  }
}

export function VoucherApp() {
  const { issues, add, markSent, setCouponUrl, reset } = useIssues()
  const [target, setTarget] = useState<WhatsAppTarget>('web')
  const [last, setLast] = useState<Issue | null>(null)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
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

  /**
   * Opens the customer's chat with the greeting typed in.
   * With coupon storage set up, the coupon PNG is uploaded first and the greeting carries its
   * download link. Without it, the image is copied for staff to paste (Ctrl+V) into the chat.
   */
  const send = useCallback(
    async (i: Issue) => {
      // Render the hidden coupon for this purchase right away so it can be turned into a PNG.
      flushSync(() => setLast(i))
      const node = captureNode()

      const finish = (sent: Issue, opened: Window | null) => {
        if (!opened) return setLast(sent) // pop-up blocked: stays "not yet sent"
        markSent(sent.id)
        setLast({ ...sent, status: 'sent', sentAt: new Date().toISOString() })
      }

      if (!couponLinksEnabled) {
        // Copy before opening the chat: the clipboard only accepts writes while this page has focus.
        const copied = node ? await copyImage(nodeToPng(node)) : false
        setSendResult(copied ? 'copied' : 'manual')
        finish(i, window.open(whatsappUrl(i, target), WA_WINDOW))
        return
      }

      // Open the WhatsApp tab now, while the click still counts for the pop-up blocker,
      // and point it at the chat once the coupon link is ready.
      const tab = window.open('', WA_WINDOW)
      let ready = i
      if (i.couponUrl) {
        setSendResult('linked')
      } else {
        try {
          if (!node) throw new Error('Coupon not rendered')
          const url = await uploadCoupon(await nodeToPng(node), couponUpload(i))
          ready = { ...i, couponUrl: url }
          setCouponUrl(i.id, url)
          setSendResult('linked')
        } catch {
          setSendResult('upload-failed')
        }
      }
      if (tab) tab.location.href = whatsappUrl(ready, target)
      finish(ready, tab)
    },
    [target, markSent, setCouponUrl],
  )

  const issue = (draft: Omit<Issue, 'id' | 'createdAt' | 'codes' | 'status'>, count: number) => {
    const taken = allCodes(issues)
    const created: Issue = {
      ...draft,
      id: `iss-${Date.now()}`,
      createdAt: new Date().toISOString(),
      codes: Array.from({ length: count }, () => makeCode(taken)),
      status: 'pending',
    }
    add(created)
    void send(created)
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'vouchers', label: 'Vouchers', count: stats.vouchers },
    { id: 'purchases', label: 'Customers', count: stats.purchases },
    { id: 'shops', label: 'Shop-wise', count: shopRows.length },
  ]

  return (
    <div className="min-h-screen">
      {last && <CouponCapture issue={last} />}
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
          <Stat icon={Ticket} label="Vouchers issued" value={stats.vouchers.toLocaleString('en-IN')} />
          <Stat icon={Users} label="Customers" value={stats.customers.toLocaleString('en-IN')} />
          <Stat icon={Store} label="Shops issuing" value={`${stats.shops} / ${shopRows.length}`} />
          <Stat
            icon={Clock}
            label="Not yet sent"
            value={String(stats.pending)}
            tone={stats.pending ? 'warn' : undefined}
            hint={stats.pending ? 'See Customers tab' : 'All sent'}
          />
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[440px_1fr]">
          <IssueForm target={target} onTarget={setTarget} onIssue={issue} onDraft={setDraft} />
          {/* Only the short preview sticks; the issued list can be taller than the screen. */}
          <div className={last ? undefined : 'lg:sticky lg:top-6'}>
            {last ? (
              <LastIssued issue={last} sendResult={sendResult} onSend={send} onDone={() => setLast(null)} />
            ) : (
              <CouponPreview draft={draft} />
            )}
          </div>
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
            <PurchaseGrid issues={issues} search={search} onReady={(api) => (gridApi.current = api)} onSend={send} />
          )}
          {tab === 'shops' && <ShopGrid issues={issues} search={search} onReady={(api) => (gridApi.current = api)} />}
        </section>
      </main>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: LucideIcon
  label: string
  value: string
  tone?: 'warn'
  hint?: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4 shadow-card">
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${
          tone === 'warn' ? 'bg-gold-soft text-gold-text' : 'bg-sand text-ink'
        }`}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-muted">{label}</p>
        <p className={`font-display text-2xl font-semibold tabular-nums ${tone === 'warn' ? 'text-gold-text' : 'text-ink'}`}>
          {value}
        </p>
        {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
      </div>
    </div>
  )
}

// ---------- form ----------

function IssueForm({
  target,
  onTarget,
  onIssue,
  onDraft,
}: {
  target: WhatsAppTarget
  onTarget: (t: WhatsAppTarget) => void
  onIssue: (draft: Omit<Issue, 'id' | 'createdAt' | 'codes' | 'status'>, count: number) => void
  onDraft: (draft: Draft) => void
}) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [place, setPlace] = useState('')
  const [shopId, setShopId] = useState('')
  const [billNo, setBillNo] = useState('')
  const [amount, setAmount] = useState('')
  const [count, setCount] = useState(0)
  const [sponsorRows, setSponsorRows] = useState<SponsorRow[]>(() => {
    const saved = loadActiveSponsors()
    return saved.length ? saved.map(sponsorRow) : [sponsorRow()]
  })
  const [tried, setTried] = useState(false)

  const amt = Number(amount)
  const eligible = eligibleVouchers(amt)
  const shop = shopId ? shopById[shopId] : undefined
  const normalised = normalisePhone(phone)

  // A row left completely empty is ignored; a half-filled row needs both image and name.
  const filledSponsors = sponsorRows.filter((s) => s.image || s.name.trim())
  const sponsorsIncomplete = filledSponsors.some((s) => !s.image || !s.name.trim())
  const sponsors: Sponsor[] = useMemo(
    () =>
      sponsorRows
        .filter((s) => s.image && s.name.trim())
        .map((s) => ({ id: sponsorId(s.name.trim(), s.image), name: s.name.trim(), image: s.image })),
    [sponsorRows],
  )

  // Remember complete sponsors so staff don't re-upload images for every customer or after a reload.
  const sponsorKey = sponsors.map((s) => s.id).join()
  useEffect(() => setActiveSponsors(sponsors), [sponsorKey])

  const previewCount = eligible ? Math.min(Math.max(count, 0), eligible) : 0
  useEffect(
    () => onDraft({ customerName: name.trim(), shopId, sponsors, count: previewCount }),
    [name, shopId, sponsors, previewCount, onDraft],
  )

  const errors = {
    phone: !normalised && 'Enter a 10-digit Indian mobile number',
    name: !name.trim() && 'Enter the customer name',
    shop: !shop && 'Pick the shop the customer bought from',
    amount: eligible === 0 && `Bill must be at least ${inr(RUPEES_PER_VOUCHER)} to earn a voucher`,
    count: (count < 1 || count > eligible) && eligible > 0 && `Choose between 1 and ${eligible}`,
    sponsors: sponsorsIncomplete && 'Each sponsor needs both a logo and a shop name',
  }

  const updateSponsor = (key: string, patch: Partial<SponsorRow>) =>
    setSponsorRows((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    onIssue(
      {
        phone: normalised!,
        customerName: name.trim(),
        place: place.trim() || '—',
        shopId,
        billNo: billNo.trim(),
        ...(sponsors.length ? { sponsorIds: rememberSponsors(sponsors) } : {}),
      },
      count,
    )
    // Keep the shop and sponsors: the counter usually issues several in a row with the same ones.
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
    <form onSubmit={submit} noValidate className="rounded-2xl border border-line bg-white shadow-card">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <h2 className="text-xl font-semibold text-ink">Issue vouchers</h2>
        <p className="mt-0.5 text-sm text-muted">
          1 voucher for every {inr(RUPEES_PER_VOUCHER)} on the bill, sent to the customer on WhatsApp.
        </p>
      </div>

      <div className="space-y-6 px-5 py-5 sm:px-6">
        <FormSection step={1} title="Customer">
          <Field label="WhatsApp number" error={err('phone')}>
            <div className="flex rounded-lg border border-line bg-white focus-within:border-gold focus-within:shadow-focus-gold has-[[aria-invalid=true]]:border-crimson">
              <span className="grid place-items-center rounded-l-lg border-r border-line bg-sand px-3 text-sm font-bold text-muted">
                +91
              </span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98470 12345"
                aria-invalid={Boolean(err('phone'))}
                className="min-h-11 w-full rounded-r-lg px-3 py-2.5 tabular-nums outline-none"
              />
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" error={err('name')}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                aria-invalid={Boolean(err('name'))}
                className={inputCls}
              />
            </Field>
            <Field label="Place" optional>
              {/* The hint starts with "e.g." so an empty box is never mistaken for a filled-in place. */}
              <input
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                list="dme-places"
                placeholder="e.g. Edakkara — type or pick"
                autoComplete="off"
                className={`${inputCls} placeholder:text-muted/60`}
              />
              <datalist id="dme-places">
                {places.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
          </div>
        </FormSection>

        <FormSection step={2} title="Purchase">
          <Field label="Shop" error={err('shop')}>
            <select
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              aria-invalid={Boolean(err('shop'))}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="">Select shop number…</option>
              {shopRows.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shopNo} · {s.name} — {s.categoryLabel}
                </option>
              ))}
            </select>
            {shop && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                <Store className="size-3.5" aria-hidden /> {shop.location} · {shop.owner}
              </p>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bill amount (₹)" hint="Not saved" error={err('amount')}>
              <input
                inputMode="numeric"
                value={amount}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, '')
                  setAmount(v)
                  setCount(eligibleVouchers(Number(v)))
                }}
                placeholder="4500"
                aria-invalid={Boolean(err('amount'))}
                className={`${inputCls} tabular-nums`}
              />
            </Field>
            <Field label="Bill number" optional>
              <input value={billNo} onChange={(e) => setBillNo(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <Field label="Vouchers to issue" error={err('count')}>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={eligible ? 1 : 0}
                max={eligible}
                disabled={eligible === 0}
                value={eligible ? count : ''}
                onChange={(e) => setCount(Math.floor(Number(e.target.value)))}
                aria-invalid={Boolean(err('count'))}
                className={`${inputCls.replace('w-full', 'w-24')} tabular-nums disabled:cursor-not-allowed disabled:bg-sand`}
              />
              {eligible ? (
                <span className="rounded-full bg-gold-soft px-3 py-1 text-sm font-semibold text-gold-text">
                  Eligible for <b className="tabular-nums">{eligible}</b>
                </span>
              ) : (
                <span className="text-sm text-muted">Enter the bill amount (min {inr(RUPEES_PER_VOUCHER)})</span>
              )}
            </div>
          </Field>
        </FormSection>

        <FormSection step={3} title="Sponsors" aside="Optional · kept for the next customer">
          <ul className="space-y-2.5">
            {sponsorRows.map((s, i) => (
              <SponsorInput
                key={s.key}
                sponsor={s}
                index={i}
                invalid={tried && Boolean(s.image) !== Boolean(s.name.trim())}
                onChange={(patch) => updateSponsor(s.key, patch)}
                onRemove={() =>
                  setSponsorRows((list) => (list.length > 1 ? list.filter((x) => x.key !== s.key) : [sponsorRow()]))
                }
              />
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setSponsorRows((list) => [...list, sponsorRow()])}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line px-3 text-sm font-bold text-ink transition-colors hover:border-gold hover:bg-gold-soft/40"
          >
            <Plus className="size-4" aria-hidden /> Add sponsor
          </button>
          {err('sponsors') && (
            <p role="alert" className="text-xs font-semibold text-crimson">
              {err('sponsors')}
            </p>
          )}
        </FormSection>
      </div>

      <div className="space-y-3 rounded-b-2xl border-t border-line bg-ivory px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span id="open-in" className="text-sm font-semibold text-ink">
            Open in
          </span>
          <div role="group" aria-labelledby="open-in" className="inline-flex rounded-lg bg-sand p-1">
            {(['web', 'app'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={target === t}
                onClick={() => onTarget(t)}
                className={`min-h-9 rounded-md px-3 text-sm font-semibold transition-colors ${
                  target === t ? 'bg-white text-ink shadow-card' : 'text-muted hover:text-ink'
                }`}
              >
                {t === 'web' ? 'WhatsApp Web' : 'WhatsApp app'}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 py-3 font-bold text-white shadow-lift transition-[background-color,transform] duration-150 hover:bg-whatsapp-hover active:scale-[0.99]"
        >
          <WhatsAppIcon className="size-5" />
          Generate {count > 0 && eligible > 0 ? `${count} ` : ''}voucher{count === 1 ? '' : 's'} & open WhatsApp
        </button>
      </div>
    </form>
  )
}

function FormSection({
  step,
  title,
  aside,
  children,
}: {
  step: number
  title: string
  aside?: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={`step-${step}`} className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-gold" aria-hidden>
          {step}
        </span>
        <h3 id={`step-${step}`} className="font-sans text-sm font-extrabold uppercase tracking-[0.12em] text-ink">
          {title}
        </h3>
        <span className="h-px flex-1 bg-line" aria-hidden />
        {aside && <span className="text-xs text-muted">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

const inputCls =
  'min-h-11 w-full rounded-lg border border-line bg-white px-3 py-2.5 outline-none transition-shadow focus:border-gold focus:shadow-focus-gold aria-[invalid=true]:border-crimson'

interface SponsorRow extends Omit<Sponsor, 'id'> {
  key: string
  loading?: boolean
}

let sponsorSeq = 0
const sponsorRow = (s?: Sponsor): SponsorRow => ({ name: s?.name ?? '', image: s?.image ?? '', key: `s-${++sponsorSeq}` })

function SponsorInput({
  sponsor,
  index,
  invalid,
  onChange,
  onRemove,
}: {
  sponsor: SponsorRow
  index: number
  invalid: boolean
  onChange: (patch: Partial<SponsorRow>) => void
  onRemove: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const empty = !sponsor.image && !sponsor.name

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError('')
    onChange({ loading: true })
    try {
      onChange({ image: await sponsorImage(file), loading: false })
    } catch {
      setError('Could not read that image')
      onChange({ loading: false })
    }
  }

  return (
    <li
      className={`flex items-center gap-3 rounded-xl border bg-white p-2.5 transition-colors ${
        invalid ? 'border-crimson' : 'border-line'
      }`}
    >
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        aria-label={sponsor.image ? `Change sponsor logo ${index + 1}` : `Upload sponsor logo ${index + 1}`}
        className={`group relative flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border transition-colors ${
          sponsor.image
            ? 'border-line bg-white p-1 hover:border-gold'
            : 'border-dashed border-gold/60 bg-gold-soft/50 text-gold-text hover:bg-gold-soft'
        }`}
      >
        {sponsor.image ? (
          <>
            <img src={sponsor.image} alt="" className="max-h-full max-w-full object-contain" />
            <span className="absolute inset-x-0 bottom-0 bg-ink/75 py-0.5 text-center text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              Change
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide">
            <ImagePlus className={`size-5 ${sponsor.loading ? 'animate-pulse' : ''}`} aria-hidden />
            {sponsor.loading ? 'Loading' : 'Upload'}
          </span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0])
          e.target.value = '' // allow re-picking the same file
        }}
      />
      <div className="min-w-0 flex-1">
        <input
          value={sponsor.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Shop name"
          aria-label={`Sponsor shop name ${index + 1}`}
          className={inputCls}
        />
        {error ? (
          <p role="alert" className="mt-1 text-xs font-semibold text-crimson">
            {error}
          </p>
        ) : (
          !sponsor.image && <p className="mt-1 text-xs text-muted">Tap the box to upload the shop logo</p>
        )}
      </div>
      {!(empty && index === 0) && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove sponsor ${index + 1}`}
          className="grid size-11 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-crimson-soft hover:text-crimson"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </li>
  )
}

function Field({
  label,
  error,
  hint,
  optional,
  children,
}: {
  label: string
  error?: string | false | null
  hint?: string
  optional?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-semibold text-ink">
        {label}
        {(optional || hint) && <span className="text-xs font-normal text-muted">{optional ? 'Optional' : hint}</span>}
      </span>
      {children}
      {error && (
        <span role="alert" className="mt-1 block text-xs font-semibold text-crimson">
          {error}
        </span>
      )}
    </label>
  )
}

// ---------- right column ----------

const steps = [
  'Customer shares their WhatsApp number at the counter.',
  `Pick the shop and enter the bill — every ${inr(RUPEES_PER_VOUCHER)} earns one voucher.`,
  'WhatsApp opens with the greeting typed, and the coupon image is copied.',
  'Paste the coupon (Ctrl+V) and send. It shows as Sent in the records below.',
]

function CouponPreview({ draft }: { draft: Draft }) {
  return (
    <section aria-labelledby="preview-title" className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-text">Live preview</p>
        <h2 id="preview-title" className="text-xl font-semibold text-ink">
          The coupon image your customer gets
        </h2>
      </div>

      <div className="mt-5 max-w-xl">
        <Coupon
          count={draft.count}
          customerName={draft.customerName}
          shopLabel={shopLabel(draft.shopId)}
          sponsors={draft.sponsors}
        />
        <p className="mt-2 text-xs text-muted">Real voucher codes are filled in when you generate them.</p>
      </div>

      <ol className="mt-6 grid gap-3 border-t border-line pt-5 text-sm text-muted sm:grid-cols-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sand text-xs font-bold text-ink">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
    </section>
  )
}

/** The id of the hidden, fixed-width copy of the coupon that is turned into the PNG. */
const CAPTURE_ID = 'coupon-capture'

/**
 * Off-screen copy of the coupon at a fixed width, so the image looks the same
 * whatever the screen size. Its white frame matches the coupon's punched notches.
 */
function CouponCapture({ issue }: { issue: Issue }) {
  return (
    <div aria-hidden className="pointer-events-none fixed -left-[10000px] top-0">
      <div id={CAPTURE_ID} className="w-[600px] bg-white p-5">
        <Coupon
          codes={issue.codes}
          customerName={issue.customerName}
          shopLabel={shopLabel(issue.shopId)}
          sponsors={sponsorsFor(issue)}
        />
      </div>
    </div>
  )
}

const captureNode = () => document.getElementById(CAPTURE_ID)

function LastIssued({
  issue,
  sendResult,
  onSend,
  onDone,
}: {
  issue: Issue
  /** How the coupon image went out on the last send; null before any send. */
  sendResult: SendResult | null
  onSend: (i: Issue) => void
  onDone: () => void
}) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [shareable] = useState(canShareImage)

  const shop = shopById[issue.shopId]
  const message = voucherMessage(issue)
  const n = issue.codes.length
  const fileName = couponFileName(issue.codes)

  const flash = (text: string) => {
    setNote(text)
    setTimeout(() => setNote(''), 2500)
  }

  /** Runs an image action with a busy state; the PNG is rendered from the hidden coupon. */
  const withImage = async (action: (blob: Blob) => Promise<void> | void) => {
    const node = captureNode()
    if (!node || busy) return
    setBusy(true)
    try {
      await action(await nodeToPng(node))
    } catch {
      flash('Could not create the coupon image')
    } finally {
      setBusy(false)
    }
  }

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(message)
      flash('Greeting text copied')
    } catch {
      flash('Copying is blocked in this browser')
    }
  }

  const secondaryBtn =
    'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink transition-colors hover:bg-sand disabled:opacity-50'

  return (
    <section aria-labelledby="issued-title" className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-pine" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-pine">Just issued</p>
            <h2 id="issued-title" className="text-xl font-semibold text-ink">
              {n} voucher{n === 1 ? '' : 's'} for {issue.customerName}
            </h2>
            <p className="text-sm text-muted tabular-nums">
              +91 {issue.phone.slice(0, 5)} {issue.phone.slice(5)} · {shop.shopNo} {shop.name}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-muted transition-colors hover:bg-sand hover:text-ink"
        >
          Done
        </button>
      </div>

      {/* How to get the image into the chat — WhatsApp links can only carry text. */}
      <div className="mt-4 rounded-xl border border-whatsapp/25 bg-[#e9f6ee] p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-ink">
          <WhatsAppIcon className="size-4 text-whatsapp" /> Send the coupon image
        </p>
        <p role="status" className="mt-1 text-sm text-ink/80">
          {issue.status === 'pending'
            ? 'The browser blocked the WhatsApp tab. Allow pop-ups for this page, then press “Open WhatsApp chat”.'
            : sendResult === 'linked'
              ? 'The chat is open with the greeting and a link to download the coupon image. Press Send in WhatsApp.'
              : sendResult === 'upload-failed'
                ? 'The coupon could not be uploaded, so the chat opened without the download link. Check the internet and press “Open WhatsApp chat” to try again, or attach the image yourself.'
                : sendResult === 'copied'
                  ? 'The coupon image is copied. In the WhatsApp chat press Ctrl+V to paste it, then send it with the greeting.'
                  : 'The chat is open with the greeting typed. Download or share the coupon image and attach it to the chat.'}
        </p>
        {issue.couponUrl && (
          <p className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-ink/80">
            <Link2 className="size-3.5 shrink-0 text-whatsapp" aria-hidden />
            <a href={issue.couponUrl} target="_blank" rel="noreferrer" className="truncate font-semibold text-whatsapp underline">
              {issue.couponUrl.replace(/^https?:\/\//, '').split('?')[0]}
            </a>
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSend(issue)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-whatsapp px-3 text-sm font-bold text-white transition-colors hover:bg-whatsapp-hover"
          >
            <ExternalLink className="size-4" aria-hidden /> Open WhatsApp chat
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              withImage(async (blob) => flash((await copyImage(blob)) ? 'Coupon image copied' : 'Copying images is blocked here — use Download'))
            }
            className={secondaryBtn}
          >
            <ClipboardCopy className="size-4" aria-hidden /> Copy image
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => withImage((blob) => downloadImage(blob, fileName))}
            className={secondaryBtn}
          >
            <ImageDown className="size-4" aria-hidden /> Download image
          </button>
          {shareable && (
            <button
              type="button"
              disabled={busy}
              onClick={() => withImage(async (blob) => void (await shareImage(blob, fileName, message.replace(/\*/g, ''))))}
              className={secondaryBtn}
            >
              <Share2 className="size-4" aria-hidden /> Share…
            </button>
          )}
          <button type="button" onClick={copyText} className={secondaryBtn}>
            <Copy className="size-4" aria-hidden /> Copy text
          </button>
        </div>
        <p aria-live="polite" className="mt-2 min-h-5 text-xs font-semibold text-pine">
          {busy ? 'Preparing the image…' : note}
        </p>
        <p className="text-xs text-muted">
          {couponLinksEnabled
            ? 'The customer taps the link in the message to download the coupon image to their phone.'
            : 'Download links are off until the coupon server is set up (see .env.example). Meanwhile, paste or attach the image.'}
        </p>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Coupon
          codes={issue.codes}
          customerName={issue.customerName}
          shopLabel={shopLabel(issue.shopId)}
          sponsors={sponsorsFor(issue)}
        />

        <div className="self-start rounded-xl bg-[#efeae2] p-3">
          <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wide text-muted">Greeting message</p>
          <div className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg rounded-tr-none bg-[#d9fdd3] p-3 text-[13px] leading-snug text-[#111b21] shadow-sm">
            {message.replace(/\*/g, '')}
          </div>
        </div>
      </div>
    </section>
  )
}
