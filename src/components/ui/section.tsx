import type { ReactNode } from "react";

export type Tone = "white" | "soft" | "green";

const BAND: Record<Tone, string> = {
  white: "bg-bg",
  soft: "bg-surface border-y border-line",
  green: "band",
};

interface SectionProps {
  id: string;
  title: string;
  description?: string;
  tone?: Tone;
  aside?: ReactNode;
  children: ReactNode;
}

/** Full-bleed band (white, light white or green) wrapping a centred container. */
export function Section({ id, title, description, tone = "white", aside, children }: SectionProps) {
  const green = tone === "green";
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={BAND[tone]}>
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
          <div className="min-w-0">
            <h2 id={`${id}-title`} className={`text-2xl font-semibold tracking-tight text-balance sm:text-3xl ${green ? "text-on-band" : ""}`}>
              {title}
            </h2>
            {description ? (
              <p className={`mt-2 max-w-2xl text-sm text-pretty sm:text-base ${green ? "text-on-band-muted" : "text-muted"}`}>{description}</p>
            ) : null}
          </div>
          {aside}
        </header>
        {children}
      </div>
    </section>
  );
}
