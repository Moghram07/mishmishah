import type { ProductTemplate } from "@/types";
import { products } from "@/lib/products/registry";

/**
 * Home products the Fabric Visualizer can map a fabric onto. Derived from the
 * product registry, so adding one — or adding a part to one — happens in
 * exactly one place: `lib/products/registry.tsx`.
 *
 * Clothing is in `lib/data/garments.ts`.
 */
export const productTemplates: ProductTemplate[] = products.map(
  ({ kind, label }) => ({ kind, label })
);
