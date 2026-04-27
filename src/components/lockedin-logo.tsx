import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Adds a subtle pulse on the road dashes */
  animated?: boolean;
  title?: string;
};

/**
 * LockedIn brandmark — concentric arches forming a tunnel with a perspective
 * road and dashed centerline. Pure SVG so it inherits `currentColor` from
 * the theme (emerald primary) and scales crisply at any size.
 */
export function LockedInLogo({ className, animated = false, title = "LockedIn" }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={cn("text-primary", className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>{title}</title>
      {/* Three concentric arches (tunnel) */}
      <path d="M10 44 V32 a22 22 0 0 1 44 0 V44" strokeWidth="2.5" />
      <path d="M16 44 V32 a16 16 0 0 1 32 0 V44" strokeWidth="2.5" opacity="0.85" />
      <path d="M22 44 V32 a10 10 0 0 1 20 0 V44" strokeWidth="2.5" opacity="0.7" />

      {/* Road edges receding to the vanishing point */}
      <path d="M22 44 L14 58" strokeWidth="2.5" />
      <path d="M42 44 L50 58" strokeWidth="2.5" />

      {/* Dashed centerline */}
      <g strokeWidth="2.6" className={animated ? "lockedin-dashes" : undefined}>
        <line x1="32" y1="46" x2="32" y2="49" />
        <line x1="32" y1="52" x2="32" y2="55" />
        <line x1="32" y1="58" x2="32" y2="60" />
      </g>

      {animated ? (
        <style>{`
          .lockedin-dashes line { transform-origin: center; animation: lockedin-pulse 2.4s ease-in-out infinite; }
          .lockedin-dashes line:nth-child(2) { animation-delay: .25s; }
          .lockedin-dashes line:nth-child(3) { animation-delay: .5s; }
          @keyframes lockedin-pulse {
            0%, 100% { opacity: .35; }
            50% { opacity: 1; }
          }
        `}</style>
      ) : null}
    </svg>
  );
}
