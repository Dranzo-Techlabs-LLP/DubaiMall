import { Check, Copy, Download, KeyRound, Power, RefreshCw, Shield, Trash2, UserPlus, Wand2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { listLogins, removeLogin, setPassword, updateLogin, type Login, type Right, type User } from './api'
import { shopById, shopRows } from './data'

const when = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmt = (iso: string | null) => (iso ? when.format(new Date(iso)) : '—')

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n))

/** A readable random password: no look-alike characters (0/O, 1/l/I). Used for the admin login. */
function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from(randomBytes(10), (b) => chars[b % chars.length]).join('')
}

const CODEWORDS = [
  'amber', 'banyan', 'cedar', 'comet', 'coral', 'ember', 'falcon', 'jade', 'jasmine', 'lotus', 'mango', 'maple',
  'monsoon', 'nova', 'onyx', 'orchid', 'pearl', 'peacock', 'pepper', 'ruby', 'saffron', 'sandal', 'tiger', 'topaz',
  'velvet', 'willow', 'cobalt', 'cardamom', 'kingfisher', 'tusker',
]

/** A shop's codename password: its name + a code word + two digits, e.g. "tanmay-falcon27". */
export function codename(shopId: string) {
  const name = shopById[shopId]?.name ?? shopId
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9 ]/g, '')
      .split(/\s+/)
      .find((w) => w.length >= 3)
      ?.slice(0, 10) ?? 'shop'
  const [a, b] = randomBytes(2)
  return `${base}-${CODEWORDS[a % CODEWORDS.length]}${10 + (b % 90)}`
}

const RIGHTS: { id: Right; label: string; hint: string }[] = [
  { id: 'issue', label: 'Issue', hint: 'Issue and release vouchers' },
  { id: 'qr', label: 'QR form', hint: 'Use the QR customer form and shop code' },
  { id: 'sponsors', label: 'Sponsors', hint: 'Change the sponsors on its coupons' },
]

interface Row {
  username: string
  label: string
  detail: string
  role: 'admin' | 'shop'
  login?: Login
}

interface Created {
  username: string
  label: string
  password: string
}

const loginText = (list: Created[]) =>
  list.map((c) => `${c.label}\nUsername: ${c.username}\nPassword: ${c.password}`).join('\n\n') +
  `\n\nVoucher desk: ${location.origin}/vouchers.html`

/** Mall admin only: shop logins, their codename passwords and what each shop may do. */
export function ShopLogins({ me }: { me: User }) {
  const [logins, setLogins] = useState<Login[] | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [created, setCreated] = useState<Created[]>([])
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      setLogins(await listLogins())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the logins')
    }
  }, [])
  useEffect(() => void load(), [load])

  // New passwords are shown at the top of the list: bring them into view after saving a row lower down.
  const createdRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (created.length) createdRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [created])

  const rows: Row[] = useMemo(() => {
    const byName = new Map((logins ?? []).map((l) => [l.username, l]))
    const admins: Row[] = (logins ?? [])
      .filter((l) => l.role === 'admin')
      .map((l) => ({ username: l.username, label: 'Mall admin', detail: l.username === me.username ? 'You' : 'Admin', role: 'admin', login: l }))
    const shops: Row[] = shopRows.map((s) => ({
      username: s.id,
      label: `${s.shopNo} · ${s.name}`,
      detail: s.categoryLabel,
      role: 'shop',
      login: byName.get(s.id),
    }))
    return [...admins, ...shops]
  }, [logins, me.username])

  const missing = rows.filter((r) => r.role === 'shop' && !r.login)
  const active = rows.filter((r) => r.role === 'shop' && r.login && !r.login.disabled).length

  /** Creates a codename login for every shop that has none yet. */
  const createAll = async () => {
    if (!missing.length) return
    if (!confirm(`Create logins for ${missing.length} shop${missing.length === 1 ? '' : 's'}? Each gets a codename password, shown once.`)) return
    const done: Created[] = []
    setBulk({ done: 0, total: missing.length })
    for (const row of missing) {
      const password = codename(row.username)
      try {
        await setPassword(row.username, password)
        done.push({ username: row.username, label: row.label, password })
      } catch (err) {
        setError(`${row.label}: ${err instanceof Error ? err.message : 'could not create the login'}`)
      }
      setBulk({ done: done.length, total: missing.length })
    }
    setBulk(null)
    setCreated(done)
    void load()
  }

  const downloadCsv = () => {
    const csv = ['Shop,Username,Password', ...created.map((c) => [c.label, c.username, c.password].map((v) => `"${v.replace(/"/g, '""')}"`).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'dubai-mall-shop-logins.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section aria-labelledby="logins-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="logins-title" className="text-xl font-semibold text-ink">
            Shop logins
          </h2>
          <p className="text-sm text-muted">
            {active} of {shopRows.length} shops can log in. Each shop sees and issues only its own vouchers. Switch rights
            on or off per shop.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {missing.length > 0 && logins !== null && (
            <button
              type="button"
              onClick={() => void createAll()}
              disabled={bulk !== null}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60"
            >
              <UserPlus className="size-4" aria-hidden />
              {bulk ? `Creating ${bulk.done} / ${bulk.total}…` : `Create ${missing.length} missing login${missing.length === 1 ? '' : 's'}`}
            </button>
          )}
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-sand"
          >
            <RefreshCw className="size-4" aria-hidden /> Refresh
          </button>
        </div>
      </div>

      {created.length > 0 && (
        <div ref={createdRef} role="status" className="space-y-3 rounded-xl border border-pine/30 bg-[#e9f6ee] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-ink">
              {created.length === 1 ? 'Password saved.' : `${created.length} logins created.`} Share {created.length === 1 ? 'it' : 'each one'} with
              the shop. Passwords aren't shown again.
            </p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={loginText(created)} label={created.length === 1 ? 'Copy login' : 'Copy all'} />
              {created.length > 1 && (
                <button type="button" onClick={downloadCsv} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-ink hover:bg-sand">
                  <Download className="size-4" aria-hidden /> CSV
                </button>
              )}
              <button type="button" onClick={() => setCreated([])} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-white">
                Done
              </button>
            </div>
          </div>
          <ul className="grid gap-1.5 font-mono text-[13px] text-ink sm:grid-cols-2 xl:grid-cols-3">
            {created.map((c) => (
              <li key={c.username} className="rounded-lg bg-white px-3 py-2">
                <span className="block truncate font-sans text-xs text-muted">{c.label}</span>
                <b>{c.username}</b> · <b>{c.password}</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-crimson-soft px-3 py-2 text-sm font-semibold text-crimson">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-sand text-xs uppercase tracking-wide text-ink">
            <tr>
              <th className="px-4 py-3 font-bold">Shop</th>
              <th className="px-4 py-3 font-bold">Username</th>
              <th className="px-4 py-3 font-bold">Access rights</th>
              <th className="hidden px-4 py-3 font-bold lg:table-cell">Last login</th>
              <th className="px-4 py-3 text-right font-bold">Login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {logins === null && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  Loading logins…
                </td>
              </tr>
            )}
            {logins !== null &&
              rows.map((row) => (
                <LoginRow
                  key={row.username}
                  row={row}
                  editing={editing === row.username}
                  onEdit={() => setEditing(editing === row.username ? null : row.username)}
                  onSaved={(password) => {
                    setEditing(null)
                    setCreated([{ username: row.username, label: row.label, password }])
                    void load()
                  }}
                  onChanged={() => void load()}
                  onError={setError}
                />
              ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function LoginRow({
  row,
  editing,
  onEdit,
  onSaved,
  onChanged,
  onError,
}: {
  row: Row
  editing: boolean
  onEdit: () => void
  onSaved: (password: string) => void
  onChanged: () => void
  onError: (message: string) => void
}) {
  const { login } = row
  const [busy, setBusy] = useState(false)
  const off = Boolean(login?.disabled)

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await action()
      onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save the change')
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    if (!confirm(`Remove the login for ${row.label}? The shop is signed out and can't log in until you set a new password.`)) return
    void act(() => removeLogin(row.username))
  }
  const toggleOff = () => {
    if (!off && !confirm(`Switch off ${row.label}? The shop is signed out and can't log in until you switch it back on.`)) return
    void act(() => updateLogin(row.username, { disabled: !off }))
  }

  return (
    <>
      <tr className={editing ? 'bg-ivory' : off ? 'bg-sand/40' : undefined}>
        <td className="px-4 py-3">
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            {row.role === 'admin' && <Shield className="size-4 text-gold-text" aria-hidden />}
            {row.label}
          </p>
          <p className="text-xs text-muted">
            {row.detail}
            {row.role === 'shop' && (
              <>
                {' · '}
                <span className={!login ? 'text-muted' : off ? 'font-semibold text-crimson' : 'font-semibold text-whatsapp'}>
                  {!login ? 'No login yet' : off ? 'Switched off' : 'Active'}
                </span>
              </>
            )}
          </p>
        </td>
        <td className="px-4 py-3 font-mono text-[13px] text-ink">{row.username}</td>
        <td className="px-4 py-3">
          {row.role === 'admin' ? (
            <span className="text-xs text-muted">Everything</span>
          ) : !login ? (
            <span className="text-xs text-muted">—</span>
          ) : (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Access rights for ${row.label}`}>
              {RIGHTS.map((r) => {
                const on = login.rights?.[r.id] !== false
                return (
                  <button
                    key={r.id}
                    type="button"
                    title={r.hint}
                    aria-pressed={on}
                    disabled={busy || off}
                    onClick={() => void act(() => updateLogin(row.username, { rights: { [r.id]: !on } }))}
                    className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                      on ? 'border-pine/30 bg-[#e3f4ea] text-pine' : 'border-line bg-white text-muted line-through'
                    }`}
                  >
                    {on && <Check className="size-3.5" aria-hidden />} {r.label}
                  </button>
                )
              })}
            </div>
          )}
        </td>
        <td className="hidden px-4 py-3 text-muted lg:table-cell">{fmt(login?.lastLoginAt ?? null)}</td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={onEdit}
              aria-expanded={editing}
              className={`inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors ${
                login ? 'border border-line bg-white text-ink hover:bg-sand' : 'bg-ink text-white hover:bg-ink-soft'
              }`}
            >
              <KeyRound className="size-4" aria-hidden /> {login ? 'Set password' : 'Create login'}
            </button>
            {login && row.role === 'shop' && (
              <>
                <button
                  type="button"
                  onClick={toggleOff}
                  disabled={busy}
                  aria-label={off ? `Switch on ${row.label}` : `Switch off ${row.label}`}
                  title={off ? 'Switch on' : 'Switch off'}
                  className={`grid size-10 place-items-center rounded-lg transition-colors disabled:opacity-50 ${
                    off ? 'bg-whatsapp text-white hover:bg-whatsapp-hover' : 'text-muted hover:bg-sand hover:text-ink'
                  }`}
                >
                  <Power className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy}
                  aria-label={`Remove the login for ${row.label}`}
                  title="Remove login"
                  className="grid size-10 place-items-center rounded-lg text-muted transition-colors hover:bg-crimson-soft hover:text-crimson disabled:opacity-50"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {editing && (
        <tr className="bg-ivory">
          <td colSpan={5} className="px-4 pb-4">
            <PasswordForm username={row.username} shop={row.role === 'shop'} onSaved={onSaved} onCancel={onEdit} />
          </td>
        </tr>
      )}
    </>
  )
}

function PasswordForm({
  username,
  shop,
  onSaved,
  onCancel,
}: {
  username: string
  shop: boolean
  onSaved: (pw: string) => void
  onCancel: () => void
}) {
  const fresh = () => (shop ? codename(username) : generatePassword())
  const [password, setPw] = useState(fresh)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters')
    setBusy(true)
    setError('')
    try {
      await setPassword(username, password)
      onSaved(password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the password')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-white p-3">
      <label className="min-w-56 flex-1">
        <span className="mb-1 block text-xs font-semibold text-ink">
          New password for {username} {shop && <span className="font-normal text-muted">· a codename, or type your own</span>}
        </span>
        <input
          value={password}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="new-password"
          spellCheck={false}
          className="min-h-11 w-full rounded-lg border border-line px-3 font-mono outline-none focus:border-gold focus:shadow-focus-gold"
        />
      </label>
      <button
        type="button"
        onClick={() => setPw(fresh())}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:bg-sand"
      >
        <Wand2 className="size-4" aria-hidden /> {shop ? 'New codename' : 'Generate'}
      </button>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-ink px-4 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60"
      >
        <Check className="size-4" aria-hidden /> {busy ? 'Saving…' : 'Save password'}
      </button>
      <button type="button" onClick={onCancel} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-sand">
        Cancel
      </button>
      {error && (
        <p role="alert" className="basis-full text-xs font-semibold text-crimson">
          {error}
        </p>
      )}
      <p className="basis-full text-xs text-muted">Saving signs this login out on every other device.</p>
    </form>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          // clipboard blocked
        }
      }}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-ink hover:bg-sand"
    >
      <Copy className="size-4" aria-hidden /> {done ? 'Copied' : label}
    </button>
  )
}
