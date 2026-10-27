import type { ReactNode } from "react";

/**
 * Buttons over the cloth, each solid and dark, with the light on its domed
 * face up toward the light: a flat dark disc read on a pale cloth and vanished
 * on a dark one, and one drawn see-through let a print show through it. Every
 * button in the wardrobe is drawn this way.
 */
export function litButtons(at: readonly (readonly [number, number])[], r: number): ReactNode {
  return (
    <g>
      {at.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={r} fill="#2b211b" />
          <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.4} fill="#ffffff" opacity="0.35" />
        </g>
      ))}
    </g>
  );
}
