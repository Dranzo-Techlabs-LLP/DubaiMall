import { useEffect, useRef } from 'react'

interface Flake {
  x: number
  y: number
  r: number
  speed: number
  drift: number
  phase: number
}

/** Gentle canvas snowfall that fills its positioned parent. Pauses off-screen; static for reduced motion. */
export function Snow({ density = 70, className = '' }: { density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let flakes: Flake[] = []
    let frame = 0
    let visible = true

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.round((density * width) / 1280) + 12
      flakes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.8 + Math.random() * 2.2,
        speed: 0.25 + Math.random() * 0.7,
        drift: 0.3 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      }))
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height)
      for (const f of flakes) {
        if (!reduce) {
          f.y += f.speed
          f.x += Math.sin(t / 1600 + f.phase) * f.drift * 0.4
          if (f.y > height + 4) {
            f.y = -4
            f.x = Math.random() * width
          }
        }
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${0.35 + f.r / 6})`
        ctx.fill()
      }
    }

    const loop = (t: number) => {
      draw(t)
      if (visible && !reduce) frame = requestAnimationFrame(loop)
    }

    resize()
    draw(0)
    const ro = new ResizeObserver(() => {
      resize()
      draw(0)
    })
    ro.observe(canvas)
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      cancelAnimationFrame(frame)
      if (visible && !reduce) frame = requestAnimationFrame(loop)
    })
    io.observe(canvas)

    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      io.disconnect()
    }
  }, [density])

  return <canvas ref={ref} className={`pointer-events-none absolute inset-0 size-full ${className}`} aria-hidden="true" />
}
