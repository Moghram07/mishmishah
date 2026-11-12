/**
 * `check:garments --quick`: run only the checks a change can reach.
 *
 * The full check measures every garment on every cut, sleeve and skirt, and
 * takes minutes. Day to day, most changes touch one garment, the collars, or
 * nothing the checker reads at all — a panel, a dictionary, the lighting. So
 * the quick mode asks git what changed (staged, unstaged and new files), follows
 * each check's source files through their imports, and runs a check only if
 * one of its files changed. Anything every garment is built from — the body,
 * the drafting kit, the garment records, this script — runs everything.
 *
 * The full check still runs before every commit; this is for in between.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/** Files every garment is built from: a change to any of them, or to anything they import, reaches every check. */
const SHARED = [
  "src/lib/mannequin/bodies.ts",
  "src/lib/mannequin/profile.ts",
  "src/lib/data/garments.ts",
  "src/lib/garments/collar.ts",
  "src/lib/garments/fit.ts",
  "src/lib/garments/sleeves.ts",
  "src/lib/garments/skirts.ts",
  "src/lib/garments/legs.ts",
  "src/lib/garments/necklines.ts",
];
/** The checker itself, and the body it measures against. */
const CHECKER = [/^scripts\/preview-garments\.mjs$/, /^scripts\/quick-check\.mjs$/, /^scripts\/measure-body\.mjs$/, /^scripts\/mannequin\//];

const posix = (p) => p.split("\\").join("/");

/** The files a module loads, followed through its imports: relative and `@/` ones, never packages. */
function closureOf(root, entries) {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const abs = join(root, file);
    if (!existsSync(abs)) return;
    const source = readFileSync(abs, "utf8");
    for (const m of source.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?!type\s)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/g)) {
      const spec = m[1];
      const base = spec.startsWith("@/") ? join(root, "src", spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(abs), spec) : null;
      if (!base) continue;
      const hit = ["", ".ts", ".tsx", ".mjs", "/index.ts", "/index.tsx"].map((ext) => base + ext).find((f) => existsSync(f) && !f.endsWith("/"));
      if (hit && /\.(ts|tsx|mjs)$/.test(hit)) visit(posix(relative(root, hit)));
    }
  };
  for (const e of entries) visit(e);
  return seen;
}

/** What changed since the last commit: modified, staged and new files, from the repository's root. */
function changedFiles(root) {
  const run = (cmd) => execSync(cmd, { cwd: root, encoding: "utf8" }).split("\n").map((l) => l.trim()).filter(Boolean);
  return [...new Set([...run("git diff --name-only HEAD"), ...run("git ls-files --others --exclude-standard")])].map(posix);
}

/**
 * Which checks to run.
 *
 * `garments` are the wardrobe's records; `artOf(garment)` its drawing, read as
 * text, with its body's yoke; `cutModule(garment)` the module it is cut in, if
 * any, loaded for real. Returns `want(section)` and a few lines saying why.
 */
export function planQuick({ root, args, garments, artOf, cutModule, collarArt }) {
  const named = args.find((a) => a.startsWith("--files="));
  const changed = named ? named.slice("--files=".length).split(",").map(posix) : changedFiles(root);

  const shared = closureOf(root, SHARED);
  const reaching = changed.filter((f) => shared.has(f) || CHECKER.some((re) => re.test(f)));
  if (reaching.length > 0) {
    return {
      want: () => true,
      full: true,
      lines: [`quick: ${reaching.join(", ")} ${reaching.length > 1 ? "reach" : "reaches"} every garment — running everything`],
    };
  }

  /* each garment's own files: its drawing and its body's yoke, as text; its cut module and what that imports */
  const own = new Map(
    garments.map((g) => {
      const files = new Set([artOf(g), `src/lib/garments/art/${g.gender}/yoke.ts`]);
      const mod = cutModule(g);
      if (mod) for (const f of closureOf(root, [mod])) if (!shared.has(f)) files.add(f);
      return [g.id, files];
    })
  );
  const of = (gs) => new Set(gs.flatMap((g) => [...own.get(g.id)]));
  const dress = garments.filter((g) => g.acceptsNeckline);
  const sections = {
    body: new Set(["src/lib/garments/art/female/yoke.ts", "src/lib/garments/art/male/yoke.ts"]),
    wardrobe: new Set([...of(garments), ...closureOf(root, ["src/lib/data/collars.ts"]), ...collarArt]),
    trousers: of(garments.filter((g) => g.category === "trousers")),
    bodice: new Set([...of(dress), ...closureOf(root, ["src/lib/garments/closures.ts"])]),
    closures: new Set([...of(dress), ...closureOf(root, ["src/lib/garments/closures.ts"])]),
    layering: new Set([...of(garments), ...closureOf(root, ["src/lib/garments/baseLayer.ts"])]),
    collars: new Set([
      ...closureOf(root, ["src/lib/data/collars.ts", "src/lib/garments/art/female/collarCuts.ts"]),
      ...collarArt,
      ...of(garments.filter((g) => g.acceptsCollar)),
    ]),
    ...Object.fromEntries(garments.map((g) => [`coverage:${g.id}`, own.get(g.id)])),
  };
  const hits = (files) => changed.some((f) => files.has(f));
  const run = Object.keys(sections).filter((s) => hits(sections[s]));
  const read = changed.filter((f) => Object.values(sections).some((files) => files.has(f)));
  const coverage = (list) => list.filter((s) => s.startsWith("coverage:"));
  const others = (list) => list.filter((s) => !s.startsWith("coverage:"));
  const skipped = Object.keys(sections).filter((s) => !run.includes(s));
  const lines =
    run.length === 0
      ? [`quick: none of the ${changed.length} changed file${changed.length === 1 ? "" : "s"} is read by the checker — nothing to run`]
      : [
          `quick: ${changed.length} changed file${changed.length === 1 ? "" : "s"}; the checker reads ${read.length}: ${read.join(", ")}`,
          `quick: running ${[...others(run), ...(coverage(run).length ? [`coverage of ${coverage(run).map((s) => s.slice(9)).join(", ")}`] : [])].join(", ")}`,
          `quick: skipping ${[...others(skipped), ...(coverage(skipped).length ? [`coverage of ${coverage(skipped).length} garments`] : [])].join(", ")}`,
        ];
  return { want: (section) => run.includes(section), full: false, lines };
}

/** "5m 07s", "42s". */
export const duration = (ms) => {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
};
