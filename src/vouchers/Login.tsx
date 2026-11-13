import { Eye, EyeOff, LogIn, Ticket } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { festival } from '../data/festival'
import { login, type User } from './api'

/** Sign-in for shops and the mall admin. */
export function Login({ onLogin, notice }: { onLogin: (user: User) => void; notice?: string }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Enter your username and password')
      return
    }
    setBusy(true)
    setError('')
    try {
      onLogin(await login(username.trim(), password))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in')
      setBusy(false)
    }
  }

  return (
    <div className="arch-pattern grid min-h-dvh place-items-center bg-ink px-4 py-10">
      <main className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center text-white">
          <span className="grid size-14 place-items-center rounded-2xl bg-gold text-ink">
            <Ticket className="size-7" aria-hidden />
          </span>
          <h1 className="mt-4 text-3xl font-semibold">Voucher desk</h1>
          <p className="mt-1 text-sm text-white/70">Dubai Mall Edakkara · {festival.name}</p>
        </div>

        <form onSubmit={submit} noValidate className="rounded-2xl bg-white p-6 shadow-lift">
          <h2 className="text-xl font-semibold text-ink">Log in</h2>
          <p className="mt-0.5 text-sm text-muted">Use the login the mall office gave your shop.</p>

          {notice && (
            <p role="status" className="mt-4 rounded-lg bg-gold-soft px-3 py-2 text-sm text-gold-text">
              {notice}
            </p>
          )}

          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              className="min-h-11 w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-gold focus:shadow-focus-gold"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">Password</span>
            <span className="flex rounded-lg border border-line focus-within:border-gold focus-within:shadow-focus-gold">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="min-h-11 w-full rounded-l-lg px-3 py-2.5 outline-none"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
                className="grid w-11 shrink-0 place-items-center rounded-r-lg text-muted hover:text-ink"
              >
                {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </span>
          </label>

          {error && (
            <p role="alert" className="mt-3 text-sm font-semibold text-crimson">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60"
          >
            <LogIn className="size-4" aria-hidden /> {busy ? 'Logging in…' : 'Log in'}
          </button>
          <p className="mt-4 text-center text-xs text-muted">Forgot the password? Ask the mall office to reset it.</p>
        </form>

        <p className="mt-6 text-center text-sm">
          <a href="/" className="font-semibold text-white/70 hover:text-white">
            ← Back to the mall website
          </a>
        </p>
      </main>
    </div>
  )
}
