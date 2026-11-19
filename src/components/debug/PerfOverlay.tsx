"use client";

/*
  TEMPORARY — the phone-speed round's measuring switch, `?debug=perf`: the
  times `lib/debug/perf.ts` takes, on screen. A line at the top shows the
  last two actions as they happen; «⏱» opens the full report, to be sent
  as a screenshot. It must not reach release.
*/

import { useEffect, useState, useSyncExternalStore } from "react";
import { clearPerf, perfEnabled, perfRecords, startPerf, subscribePerf, type PerfKind, type PerfRecord } from "@/lib/debug/perf";

const TARGET = { card: 100, figure: 300, frame: 17 };
const tone = (v: number | undefined, target: number) =>
  v === undefined ? "#9ca3af" : v <= target ? "#4ade80" : v <= target * 2 ? "#fbbf24" : "#f87171";

function Num({ v, target }: { v: number | undefined; target: number }) {
  return <span style={{ color: tone(v, target), fontWeight: 700 }}>{v === undefined ? "–" : v}</span>;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : undefined;
};
const worst = (xs: number[]) => (xs.length ? Math.max(...xs) : undefined);

function device() {
  const ua = navigator.userAgent;
  const ios = /iPhone OS (\d+)_(\d+)/.exec(ua);
  const safari = /Version\/([\d.]+)/.exec(ua);
  const chrome = /Chrome\/(\d+)/.exec(ua);
  const os = ios ? `iOS ${ios[1]}.${ios[2]}` : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : "";
  const browser = chrome ? `Chrome ${chrome[1]}` : safari ? `Safari ${safari[1]}` : "";
  const time = new Date().toTimeString().slice(0, 5);
  return `${os} ${browser} · dpr ${window.devicePixelRatio} · ${window.innerWidth}×${window.innerHeight} · ${time}`;
}

/** One action, on one line. */
function Line({ r }: { r: PerfRecord }) {
  return (
    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      <span style={{ opacity: 0.6 }}>#{r.n} </span>
      {r.kind} <bdi style={{ opacity: 0.85, fontFamily: "var(--font-arabic), system-ui, sans-serif" }}>{r.label}</bdi>
      {r.frames ? (
        <>
          {" "}· {r.frames.count} frames, typical <Num v={r.frames.typical} target={TARGET.frame} />, worst{" "}
          <Num v={r.frames.worst} target={TARGET.frame} />, slow {r.frames.slow}
          {r.figure !== undefined && (
            <>
              {" "}· redraw <Num v={r.figure} target={TARGET.figure} />
            </>
          )}
        </>
      ) : r.kind === "load" || r.kind === "pictures" ? (
        <>
          {" "}· {r.figure !== undefined && <Num v={r.figure} target={1500} />} {r.note}
        </>
      ) : (
        <>
          {" "}· card <Num v={r.card} target={TARGET.card} />
          {r.figure !== undefined && (
            <>
              {" "}· figure <Num v={r.figure} target={TARGET.figure} />
              <span style={{ opacity: 0.6 }}> (js {r.js})</span>
            </>
          )}
        </>
      )}
    </div>
  );
}

const ORDER: PerfKind[] = ["open", "look", "card", "chip", "option", "fabric", "part", "filter", "tab", "zoom", "undo", "other"];

export function PerfOverlay() {
  const [on, setOn] = useState(false);
  const [report, setReport] = useState(false);
  const recs = useSyncExternalStore(subscribePerf, perfRecords, () => []);
  useEffect(() => {
    if (!perfEnabled()) return;
    setOn(true);
    startPerf();
  }, []);
  if (!on) return null;

  const box: React.CSSProperties = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", direction: "ltr", textAlign: "left" };
  const last = recs.slice(-2);

  return (
    <>
      {/* the last two, as they happen — never in the way of a tap */}
      <div
        style={{ ...box, position: "fixed", top: 100, left: "50%", transform: "translateX(-50%)", zIndex: 300, pointerEvents: "none", maxWidth: "78vw", fontSize: 10.5, lineHeight: 1.35, background: "rgba(0,0,0,0.72)", color: "#f5f5f5", borderRadius: 8, padding: "3px 7px" }}
      >
        {last.length === 0 ? <div>perf on — tap anything</div> : last.map((r) => <Line key={r.n} r={r} />)}
      </div>
      <button
        data-perf-ui
        onClick={() => setReport(true)}
        aria-label="perf report"
        style={{ ...box, position: "fixed", left: 6, top: 112, zIndex: 300, width: 44, height: 44, borderRadius: 22, background: "rgba(0,0,0,0.78)", color: "#fff", fontSize: 12, fontWeight: 700, border: "1px solid rgba(255,255,255,0.3)" }}
      >
        ⏱{recs.length}
      </button>

      {report && (
        <div data-perf-ui style={{ ...box, position: "fixed", inset: 0, zIndex: 310, background: "rgba(12,12,12,0.96)", color: "#eee", fontSize: 11, lineHeight: 1.45, overflow: "auto", padding: "max(10px, env(safe-area-inset-top)) 10px 24px" }}>
          <div style={{ fontWeight: 700 }}>perf · {device()}</div>
          <div style={{ opacity: 0.7 }}>
            targets: card ≤ {TARGET.card} ms · figure ≤ {TARGET.figure} ms · frames ≤ {TARGET.frame} ms (green ok, amber ≤ 2×, red over)
          </div>
          <div style={{ marginTop: 8 }}>
            {recs
              .filter((r) => r.kind === "load" || r.kind === "pictures" || r.kind === "open")
              .map((r) => (
                <Line key={r.n} r={r} />
              ))}
          </div>

          {/* by kind: how many, the typical and the worst */}
          <table style={{ marginTop: 8, borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ opacity: 0.7, textAlign: "left" }}>
                <th style={{ fontWeight: 600 }}>kind</th>
                <th style={{ fontWeight: 600 }}>n</th>
                <th style={{ fontWeight: 600 }}>card med/worst</th>
                <th style={{ fontWeight: 600 }}>figure med/worst</th>
              </tr>
            </thead>
            <tbody>
              {ORDER.map((kind) => {
                const of = recs.filter((r) => r.kind === kind);
                if (of.length === 0) return null;
                const cards = of.flatMap((r) => (r.card === undefined ? [] : [r.card]));
                const figs = of.flatMap((r) => (r.figure === undefined ? [] : [r.figure]));
                return (
                  <tr key={kind} style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                    <td>{kind}</td>
                    <td>{of.length}</td>
                    <td>
                      <Num v={median(cards)} target={TARGET.card} /> / <Num v={worst(cards)} target={TARGET.card} />
                    </td>
                    <td>
                      {figs.length ? (
                        <>
                          <Num v={median(figs)} target={TARGET.figure} /> / <Num v={worst(figs)} target={TARGET.figure} />
                        </>
                      ) : (
                        "–"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 8 }}>
            {recs
              .filter((r) => r.frames)
              .map((r) => (
                <Line key={r.n} r={r} />
              ))}
          </div>

          <div style={{ marginTop: 10, opacity: 0.7 }}>every action, in order:</div>
          {recs
            .filter((r) => r.kind !== "load" && r.kind !== "pictures")
            .map((r) => (
              <Line key={r.n} r={r} />
            ))}

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={() => setReport(false)} style={{ height: 44, padding: "0 18px", borderRadius: 22, background: "#fff", color: "#111", fontWeight: 700 }}>
              close
            </button>
            <button onClick={() => clearPerf()} style={{ height: 44, padding: "0 18px", borderRadius: 22, background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.4)", fontWeight: 700 }}>
              clear
            </button>
          </div>
        </div>
      )}
    </>
  );
}
