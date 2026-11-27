"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { Fabric } from "@/types";
import { offeredFabrics } from "@/lib/data/fabrics";
import { sentPayload } from "@/lib/share/sentLink";

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

interface VisualizerValue {
  isOpen: boolean;
  fabric: Fabric;
  /** Open the visualizer, optionally pre-loading a fabric. */
  open: (fabric?: Fabric) => void;
  close: () => void;
  setFabric: (fabric: Fabric) => void;
  /**
   * A design sent as a link — the `#d=` part of the address the page opened
   * at, or moved to — for the visualizer to put on. `at` tells one arrival
   * from the next: the same link opened twice is two.
   */
  sent: { payload: string; at: number } | null;
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

  /*
    A link to a design opens the visualizer on it — on the page's first load,
    or when the address moves to one. Only the part after the `#` carries it,
    and a browser never sends that to any server. The address then keeps the
    page alone, so a reload does not put the design back on over the changes
    made since. Reading it takes the whole catalogue, which comes with the
    visualizer: here, it is only noticed.
  */
  const [sent, setSent] = useState<VisualizerValue["sent"]>(null);
  const arrivals = useRef(0);
  useEffect(() => {
    const arrive = () => {
      const payload = sentPayload(window.location.hash);
      if (payload === null) return;
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      setSent({ payload, at: ++arrivals.current });
      setIsOpen(true);
    };
    arrive();
    window.addEventListener("hashchange", arrive);
    return () => window.removeEventListener("hashchange", arrive);
  }, []);

  /* fetched while the page is idle, so it is there by the time it is opened */
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => void loadVisualizer(), { timeout: 4000 });
    else setTimeout(() => void loadVisualizer(), 2000);
  }, []);

  const value = useMemo<VisualizerValue>(
    () => ({ isOpen, fabric, open, close, setFabric, sent }),
    [isOpen, fabric, open, close, sent]
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
