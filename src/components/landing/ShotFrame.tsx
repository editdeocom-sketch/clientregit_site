import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type ShotFrameProps = {
  src: string
  alt: string
  label?: string
  className?: string
  eager?: boolean
}

export function ShotFrame({ src, alt, label, className = '', eager = false }: ShotFrameProps) {
  const srcset = src.endsWith('.webp') ? `${src.replace('.webp', '-892.webp')} 892w, ${src} 1783w` : undefined
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  return (
    <>
      <div className={`overflow-hidden rounded-xl border border-line bg-surface shadow-2xl ${className}`}>
        <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          {label && <span className="ml-2 truncate text-xs font-medium text-muted">{label}</span>}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block w-full cursor-zoom-in"
          aria-label={`View full size: ${alt}`}
        >
          <img
            src={src}
            srcSet={srcset}
            sizes="(max-width: 768px) 100vw, 50vw"
            alt={alt}
            className="block w-full"
            width={1783}
            height={1094}
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={eager ? 'high' : 'auto'}
          />
        </button>
      </div>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-6"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={alt}
          >
            <img
              src={src}
              alt={alt}
              className="max-h-full max-w-full rounded-lg shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close full size view"
              className="absolute top-4 right-4 rounded-md bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>,
          document.body
        )}
    </>
  )
}
