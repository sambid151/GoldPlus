// Purely decorative rising bars (not data). Heights step upward left to right.
const HEIGHTS = [18, 26, 22, 34, 30, 44, 40, 56, 52, 68, 62, 80, 74, 92];

export function HeroBars() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 flex h-full items-end justify-end gap-1.5 overflow-hidden px-4 sm:gap-2.5 sm:px-6">
      {HEIGHTS.map((h, i) => (
        <span
          key={i}
          className="grow-y w-4 rounded-t-lg bg-gradient-to-t from-white/30 to-white/5 sm:w-7"
          style={{ height: `${h}%`, ["--i" as string]: i }}
        />
      ))}
    </div>
  );
}
