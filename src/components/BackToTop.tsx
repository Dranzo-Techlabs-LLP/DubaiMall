import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import { useState } from 'react'

/** Floating button with a ring that fills as the page is read; appears after the first screen. */
export function BackToTop() {
  const { scrollY, scrollYProgress } = useScroll()
  const [show, setShow] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => setShow(y > window.innerHeight))

  return (
    <AnimatePresence>
      {show && (
        <motion.a
          href="#top"
          aria-label="Back to top"
          initial={{ opacity: 0, scale: 0.6, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 16, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-ink text-ivory shadow-lift"
        >
          <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
            <circle cx="28" cy="28" r="25" fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="3" />
            <motion.circle
              cx="28"
              cy="28"
              r="25"
              fill="none"
              stroke="var(--color-gold)"
              strokeWidth="3"
              strokeLinecap="round"
              style={{ pathLength: scrollYProgress }}
            />
          </svg>
          <ArrowUp className="relative size-5" aria-hidden="true" />
        </motion.a>
      )}
    </AnimatePresence>
  )
}
