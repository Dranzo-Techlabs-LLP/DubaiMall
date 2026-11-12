interface Props {
  /** Basename in /public/images — files exist as `<name>-800.webp` and `<name>-1600.webp` (4:3, except wedding-bride at 4:5). */
  name: string
  alt: string
  sizes?: string
  className?: string
  eager?: boolean
}

export function Photo({ name, alt, sizes = '(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw', className, eager }: Props) {
  return (
    <img
      src={`/images/${name}-800.webp`}
      srcSet={`/images/${name}-800.webp 800w, /images/${name}-1600.webp 1600w`}
      sizes={sizes}
      width={800}
      height={600}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={className}
    />
  )
}
