"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { Fabric } from "@/types";
import { offeredFabrics } from "@/lib/data/fabrics";

/*
  The visualizer is not part of the page's first load: its code arrives once
  the page is idle (see the effect below), or when it is opened, whichever is
  first. Opened before that, a spinner holds its place for the moment.
*/
const loadVisualizer = () => import("@/components/visualizer/FabricVisualizer").then((m) => m.FabricVisualizer);
const FabricVisualizer = dynamic(loadVisualizer, { ssr: false, loading: () => <VisualizerLoading /> });

function VisualizerLoading() {
  const { isOpen } = useVisualizer();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80">
      <Loader2 className="h-8 w-8 animate-spin text-apricot-500" />
    </div>
  );
}
// TEMPORARY — the phone-speed measurement (?debug=perf); remove before release
import { PerfOverlay } from "@/components/debug/PerfOverlay";

interface VisualizerValue {
  isOpen: boolean;
  fabric: Fabric;
  /** Open the visualizer, optionally pre-loading a fabric. */
  open: (fabric?: Fabric) => void;
  close: () => void;
  setFabric: (fabric: Fabric) => void;
}

const VisualizerContext = createContext<VisualizerValue | null>(null);

export function VisualizerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [fabric, setFabric] = useState<Fabric>(offeredFabrics[0]);

  const open = useCallback((f?: Fabric) => {
    if (f) setFabric(f);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  /* fetched while the page is idle, so it is there by the time it is opened */
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => void loadVisualizer(), { timeout: 4000 });
    else setTimeout(() => void loadVisualizer(), 2000);
  }, []);

  const value = useMemo<VisualizerValue>(
    () => ({ isOpen, fabric, open, close, setFabric }),
    [isOpen, fabric, open, close]
  );

  return (
    <VisualizerContext.Provider value={value}>
      {children}
      <FabricVisualizer />
      <PerfOverlay />
    </VisualizerContext.Provider>
  );
}

export function useVisualizer(): VisualizerValue {
  const ctx = useContext(VisualizerContext);
  if (!ctx) throw new Error("useVisualizer must be used within VisualizerProvider");
  return ctx;
}
