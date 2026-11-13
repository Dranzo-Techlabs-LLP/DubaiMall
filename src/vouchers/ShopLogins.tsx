import { Check, Copy, KeyRound, RefreshCw, Shield, Trash2, Wand2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { listLogins, removeLogin, setPassword, type Login, type User } from './api'
import { shopRows } from './data'

const when = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmt = (iso: string | null) => (iso ? when.format(new Date(iso)) : '—')

/** A readable random password: no look-alike characters (0/O, 1/l/I). */
function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

interface Row {
  username: string
  label: string
  detail: string
  role: 'admin' | 'shop'
  login?: Login
}

/** Mall admin only: create, reset and remove the login for each shop. */
export function ShopLogins({ me }: { me: User }) {
  const [logins, setLogins] = useState<Login[] | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [shared, setShared] = useState<{ username: string; password: string } | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      setLogins(await listLogins())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the logins')
    }
  }, [])
  useEffect(() => void load(), [load])

  // The new password is shown at the top of the list: bring it into view after saving a row lower down.
  const sharedRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (shared) sharedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [shared])

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

  const active = rows.filter((r) => r.role === 'shop' && r.login).length

  return (
    <section aria-labelledby="logins-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="logins-title" className="text-xl font-semibold text-ink">
            Shop logins
          </h2>
          <p className="text-sm text-muted">
            {active} of {shopRows.length} shops can log in. Each shop sees and issues only its own vouchers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-sand"
        >
          <RefreshCw className="size-4" aria-hidden /> Refresh
        </button>
      </div>

      {shared && (
        <div
          ref={sharedRef}
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pine/30 bg-[#e9f6ee] p-4"
        >
          <div className="text-sm text-ink">
            <p className="font-bold">Password saved. Share this with the shop. It won't be shown again.</p>
            <p className="mt-1 font-mono">
              Username: <b>{shared.username}</b> · Password: <b>{shared.password}</b>
            </p>
          </div>
          <div className="flex gap-2">
            <CopyButton text={`Voucher desk login\nUsername: ${shared.username}\nPassword: ${shared.password}\n${location.origin}/vouchers.html`} />
            <button type="button" onClick={() => setShared(null)} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-white">
              Done
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-crimson-soft px-3 py-2 text-sm font-semibold text-crimson">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-sand text-xs uppercase tracking-wide text-ink">
            <tr>
              <th className="px-4 py-3 font-bold">Shop</th>
              <th className="px-4 py-3 font-bold">Username</th>
              <th className="hidden px-4 py-3 font-bold md:table-cell">Status</th>
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
                    setShared({ username: row.username, password })
                    void load()
                  }}
                  onRemoved={() => void load()}
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
  onRemoved,
}: {
  row: Row
  editing: boolean
  onEdit: () => void
  onSaved: (password: string) => void
  onRemoved: () => void
}) {
  const has = Boolean(row.login)
  const [removing, setRemoving] = useState(false)

  const remove = async () => {
    if (!confirm(`Remove the login for ${row.label}? The shop is signed out and can't log in until you set a new password.`)) return
    setRemoving(true)
    try {
      await removeLogin(row.username)
      onRemoved()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not remove the login')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <tr className={editing ? 'bg-ivory' : undefined}>
        <td className="px-4 py-3">
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            {row.role === 'admin' && <Shield className="size-4 text-gold-text" aria-hidden />}
            {row.label}
          </p>
          <p className="text-xs text-muted">{row.detail}</p>
        </td>
        <td className="px-4 py-3 font-mono text-[13px] text-ink">{row.username}</td>
        <td className="hidden px-4 py-3 md:table-cell">
          {has ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e3f4ea] px-2.5 py-1 text-xs font-bold text-whatsapp">
              <span className="size-1.5 rounded-full bg-whatsapp" /> Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sand px-2.5 py-1 text-xs font-bold text-muted">
              <span className="size-1.5 rounded-full bg-muted" /> No login yet
            </span>
          )}
        </td>
        <td className="hidden px-4 py-3 text-muted lg:table-cell">{fmt(row.login?.lastLoginAt ?? null)}</td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={onEdit}
              aria-expanded={editing}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${
                has ? 'border border-line bg-white text-ink hover:bg-sand' : 'bg-ink text-white hover:bg-ink-soft'
              }`}
            >
              <KeyRound className="size-4" aria-hidden /> {has ? 'Reset password' : 'Create login'}
            </button>
            {has && row.role === 'shop' && (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={removing}
                aria-label={`Remove the login for ${row.label}`}
                className="grid size-10 place-items-center rounded-lg text-muted transition-colors hover:bg-crimson-soft hover:text-crimson disabled:opacity-50"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </div>
        </td>
      </tr>
      {editing && (
        <tr className="bg-ivory">
          <td colSpan={5} className="px-4 pb-4">
            <PasswordForm username={row.username} onSaved={onSaved} onCancel={onEdit} />
          </td>
        </tr>
      )}
    </>
  )
}

function PasswordForm({ username, onSaved, onCancel }: { username: string; onSaved: (pw: string) => void; onCancel: () => void }) {
  const [password, setPw] = useState(generatePassword)
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
        <span className="mb-1 block text-xs font-semibold text-ink">New password for {username}</span>
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
        onClick={() => setPw(generatePassword())}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:bg-sand"
      >
        <Wand2 className="size-4" aria-hidden /> Generate
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

function CopyButton({ text }: { text: string }) {
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
      <Copy className="size-4" aria-hidden /> {done ? 'Copied' : 'Copy login'}
    </button>
  )
}
