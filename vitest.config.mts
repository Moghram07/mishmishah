import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

/* the sheets' folders, made when sheets are written (a clean-up removes them with the sheets) */
if (process.env.SHEETS) for (const dir of [".preview/wardrobe", ".preview/home"]) mkdirSync(dir, { recursive: true });

export default defineConfig({
  // The app's tsconfig sets jsx: "preserve" for Next, so the test runner needs
  // its own JSX transform to import components.
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    /*
      The preview sheets — whole outfits and products drawn for an eye to judge,
      nearly a gigabyte of HTML in .preview — are written only when images are
      being made: `SHEETS=1 npx vitest run <file> -t "<describe>"` (PowerShell:
      `$env:SHEETS=1`). An ordinary run checks, and writes nothing.
    */
    exclude: process.env.SHEETS
      ? configDefaults.exclude
      : [...configDefaults.exclude, "src/lib/garments/look.test.tsx", "src/lib/products/home.test.tsx"],
  },
});
