import { motion } from 'framer-motion'

interface Props {
  text: string
  /** Trailing words rendered in the accent colour. */
  accent?: string
  accentClassName?: string
  className?: string
  as?: 'h1' | 'h2'
}

/** Heading whose words rise into place one after another as it scrolls into view. */
export function RevealHeading({ text, accent, accentClassName = 'text-gold', className, as = 'h2' }: Props) {
  const Tag = motion[as]
  const words = [
    ...text.split(' ').map((w) => ({ w, accent: false })),
    ...(accent ? accent.split(' ').map((w) => ({ w, accent: true })) : []),
  ]
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '-60px' }}
      transition={{ staggerChildren: 0.06 }}
      aria-label={[text, accent].filter(Boolean).join(' ')}
    >
      {words.map(({ w, accent: isAccent }, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.12em] align-top" aria-hidden="true">
          <motion.span
            className={`inline-block ${isAccent ? accentClassName : ''}`}
            variants={{ hidden: { y: '110%', rotate: 4 }, shown: { y: 0, rotate: 0 } }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </Tag>
  )
}
