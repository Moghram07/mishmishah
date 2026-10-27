"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { Fabric } from "@/types";
import { fabrics } from "@/lib/data/fabrics";
import { FabricVisualizer } from "@/components/visualizer/FabricVisualizer";

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
  const [fabric, setFabric] = useState<Fabric>(fabrics[0]);

  const open = useCallback((f?: Fabric) => {
    if (f) setFabric(f);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo<VisualizerValue>(
    () => ({ isOpen, fabric, open, close, setFabric }),
    [isOpen, fabric, open, close]
  );

  return (
    <VisualizerContext.Provider value={value}>
      {children}
      <FabricVisualizer />
    </VisualizerContext.Provider>
  );
}

export function useVisualizer(): VisualizerValue {
  const ctx = useContext(VisualizerContext);
  if (!ctx) throw new Error("useVisualizer must be used within VisualizerProvider");
  return ctx;
}
