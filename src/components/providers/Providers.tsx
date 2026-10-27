"use client";

import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { VisualizerProvider } from "@/components/providers/VisualizerProvider";

/** Client-side app shell: theme, locale/RTL, and the global Fabric Visualizer. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <VisualizerProvider>{children}</VisualizerProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
