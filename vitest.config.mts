import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

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
    // Every test may take a minute, as the heavy drawing sheets already could.
    // A drawing test that takes a second on its own took over five once the
    // whole suite drew at once on every core, and failed for that alone; what
    // a test checks is the same either way. Those given longer keep it.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
