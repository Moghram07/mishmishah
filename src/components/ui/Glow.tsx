import { cn } from "@/lib/utils/cn";

/**
 * A soft round glow: a disc of colour, blurred — drawn as a radial gradient.
 *
 * It used to be the disc itself under a CSS `filter: blur()`, and Safari on
 * an iPhone (iOS 26) painted the page's first tile — its top-left 170 × 170
 * px — black on any page that had one: the home page's (2026-11-19, found
 * with ?debug switches on the user's iPhone; Chrome and WebKit elsewhere
 * draw it fine). The gradient is the same light with no filter: at each
 * distance from the centre, the share of the disc a Gaussian of `blur`
 * centred there covers — exactly what the blur filter computes — laid out as
 * the gradient's stops, out to where it has faded to nothing.
 *
 * `className` places it, as the disc was placed: its box is the disc's
 * (`size` across), and the light spreads past it by three times `blur`, as
 * the filter's did, for whatever clips it to clip.
 */
export function Glow({
  size,
  blur,
  color,
  alpha = 1,
  className,
}: {
  /** The disc's diameter, in CSS px. */
  size: number;
  /** The blur's standard deviation, in CSS px — Tailwind's 2xl blur is 40, its 3xl blur 64. */
  blur: number;
  /** `#rrggbb`. */
  color: string;
  /** The disc's own opacity, before it is blurred. */
  alpha?: number;
  className?: string;
}) {
  const reach = 3 * blur;
  return (
    <span aria-hidden className={cn("pointer-events-none absolute block", className)} style={{ width: size, height: size }}>
      <span className="absolute block" style={{ inset: -reach, backgroundImage: glowGradient(size / 2, blur, color, alpha) }} />
    </span>
  );
}

/** How many stops the gradient is laid in: more than the eye can tell from the filter. */
const STOPS = 24;

const cache = new Map<string, string>();

/** The radial gradient of a disc of radius `R`, blurred by `s`, in `color` at `alpha`: out to `R + 3s`. */
export function glowGradient(R: number, s: number, color: string, alpha: number): string {
  const key = `${R}|${s}|${color}|${alpha}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const n = parseInt(color.replace("#", ""), 16);
  const rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  const E = R + 3 * s;
  const stops = Array.from({ length: STOPS + 1 }, (_, i) => {
    const r = (E * i) / STOPS;
    const a = i === STOPS ? 0 : alpha * covered(r, R, s);
    return `rgba(${rgb},${+a.toFixed(4)}) ${+((100 * i) / STOPS).toFixed(3)}%`;
  });
  const gradient = `radial-gradient(circle closest-side, ${stops.join(", ")})`;
  cache.set(key, gradient);
  return gradient;
}

/**
 * The share of a disc of radius `R` that a Gaussian of standard deviation `s`
 * centred at distance `r` from the disc's centre covers: what a blur of `s`
 * leaves of the disc at that point. In polar coordinates about the disc's
 * centre, ∫₀ᴿ ρ/s² · e^(−(ρ² + r²)/2s²) · I₀(ρr/s²) dρ, by Simpson's rule.
 */
export function covered(r: number, R: number, s: number): number {
  const steps = 400;
  const s2 = s * s;
  let sum = 0;
  for (let k = 0; k <= steps; k++) {
    const rho = (R * k) / steps;
    const w = k === 0 || k === steps ? 1 : k % 2 ? 4 : 2;
    // e^(−(ρ² + r²)/2s²) · I₀(ρr/s²) as e^(−(ρ − r)²/2s²) · I₀(x)e^(−x): never an overflow, however sharp the blur
    sum += w * (rho / s2) * Math.exp(-((rho - r) ** 2) / (2 * s2)) * besselI0Scaled((rho * r) / s2);
  }
  return (sum * R) / (3 * steps);
}

/** I₀(x)·e^(−x), the modified Bessel function scaled: by its series where that is exact, its asymptotic form beyond. */
function besselI0Scaled(x: number): number {
  if (x < 25) {
    let sum = 1;
    let term = 1;
    for (let k = 1; k < 200; k++) {
      term *= (x / (2 * k)) ** 2;
      sum += term;
      if (term < sum * 1e-14) break;
    }
    return sum * Math.exp(-x);
  }
  // 1/√(2πx) · (1 + 1/8x + 9/128x² + 225/3072x³)
  const t = 1 / x;
  return (1 + t / 8 + (9 * t * t) / 128 + (225 * t * t * t) / 3072) / Math.sqrt(2 * Math.PI * x);
}
