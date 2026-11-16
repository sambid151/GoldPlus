/** Logo: three rising bars with an upward arrow. Decorative; the wordmark carries the name. */
export function GrowthMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <rect x="7" y="19" width="4.5" height="6" rx="1.2" fill="#fff" fillOpacity="0.7" />
      <rect x="13.75" y="14" width="4.5" height="11" rx="1.2" fill="#fff" fillOpacity="0.85" />
      <rect x="20.5" y="8" width="4.5" height="17" rx="1.2" fill="#fff" />
    </svg>
  );
}
