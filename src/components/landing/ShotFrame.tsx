type ShotFrameProps = {
  src: string
  alt: string
  label?: string
  className?: string
}

export function ShotFrame({ src, alt, label, className = '' }: ShotFrameProps) {
  return (
    <div className={`overflow-hidden rounded-xl border border-line bg-surface shadow-2xl ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        {label && <span className="ml-2 truncate text-xs font-medium text-muted">{label}</span>}
      </div>
      <img src={src} alt={alt} className="block w-full" loading="lazy" />
    </div>
  )
}
