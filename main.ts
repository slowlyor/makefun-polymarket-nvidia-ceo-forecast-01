// polymarket-nvidia-ceo-forecast-01 entry: data-driven quantile forecaster.
// For each market, the conditional distribution of the h-minute price change is
// estimated from that market's own recent history (empirical quantiles of
// h-step changes over a ladder of horizons, interpolated in sqrt(h)), shrunk
// toward the pooled all-market distribution of the same case, and each
// change-quantile is then scaled toward 0 (0.7 for the inner levels and the
// median, 0.55 for the 0.05/0.95 pair), which keeps the forecast centred on
// the last price with bands that reflect each market's own step/jump
// behaviour, including its mass at 0. The constants were chosen on the kit's
// practice cases. Deterministic: the output is a pure function of the case.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const QUANTILES = [0.05, 0.25, 0.5, 0.75, 0.95];
// ---- tunables (defaults are the submitted configuration) ----
const WINDOW = 720; // minutes of history (by change end-time) per market
const K_SHRINK = 3000; // pseudo-count of the pooled distribution in the blend
const SPREAD_MONO = 1; // enforce band width non-decreasing in h
const SCALE = 0.7; // multiplier on the inner/median change-quantiles
const SCALE_OUT = 0.55; // multiplier on the 0.05/0.95 change-quantiles
const LADDER = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 180, 240];

interface CaseMarket { id: string; prices: number[]; }
interface Case { horizon_minutes: number; quantiles: number[]; markets: CaseMarket[]; }

const price6 = (x: number): number => Math.round(Math.min(1, Math.max(0, x)) * 1e6) / 1e6 + 0;

/** Empirical quantile (type-7 linear interpolation) of a sorted array. */
function quantileSorted(a: number[], tau: number): number {
  const m = a.length;
  if (m === 0) return 0;
  if (m === 1) return a[0] as number;
  const pos = tau * (m - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, m - 1);
  const frac = pos - lo;
  return (a[lo] as number) * (1 - frac) + (a[hi] as number) * frac;
}

/** h-step changes of one price series whose end index lies in the last WINDOW minutes. */
function changes(prices: number[], h: number): number[] {
  const n = prices.length;
  const out: number[] = [];
  const eMin = Math.max(h, n - WINDOW);
  for (let e = eMin; e < n; e++) out.push((prices[e] as number) - (prices[e - h] as number));
  return out;
}

function forecastCase(c: Case): { id: string; q: number[][] }[] {
  const H = c.horizon_minutes;
  const ladder = LADDER.filter((h) => h <= H);
  if (ladder[ladder.length - 1] !== H) ladder.push(H);
  // Per ladder horizon: per-market quantiles and the pooled quantiles.
  type Node = { h: number; per: Map<string, number[]>; pool: number[] };
  const nodes: Node[] = [];
  for (const h of ladder) {
    const per = new Map<string, number[]>();
    const poolArr: number[] = [];
    const cache = new Map<string, number[]>();
    for (const m of c.markets) {
      const ch = changes(m.prices, h);
      cache.set(m.id, ch);
      for (const v of ch) poolArr.push(v);
    }
    poolArr.sort((a, b) => a - b);
    const pool = QUANTILES.map((t) => quantileSorted(poolArr, t));
    for (const m of c.markets) {
      const ch = (cache.get(m.id) as number[]).slice().sort((a, b) => a - b);
      const qm = QUANTILES.map((t) => quantileSorted(ch, t));
      const alpha = ch.length / (ch.length + K_SHRINK);
      per.set(m.id, qm.map((v, j) => alpha * v + (1 - alpha) * (pool[j] as number)));
    }
    nodes.push({ h, per, pool });
  }
  // Quantile-of-change at arbitrary h: linear interpolation in sqrt(h).
  function changeQuantiles(id: string, h: number): number[] {
    if (h <= (nodes[0] as Node).h) return (nodes[0] as Node).per.get(id) as number[];
    for (let i = 1; i < nodes.length; i++) {
      const b = nodes[i] as Node;
      if (h <= b.h) {
        const a = nodes[i - 1] as Node;
        const s = (Math.sqrt(h) - Math.sqrt(a.h)) / (Math.sqrt(b.h) - Math.sqrt(a.h));
        const qa = a.per.get(id) as number[]; const qb = b.per.get(id) as number[];
        return qa.map((v, j) => v * (1 - s) + (qb[j] as number) * s);
      }
    }
    return (nodes[nodes.length - 1] as Node).per.get(id) as number[];
  }
  return c.markets.map((m) => {
    if (m.prices.length === 0) throw new Error(`market ${m.id} has no prices`);
    const x = m.prices[m.prices.length - 1] as number;
    const rows: number[][] = [];
    for (let h = 1; h <= H; h++) rows.push(changeQuantiles(m.id, h));
    if (SPREAD_MONO) {
      // Widen-only pass: each tau's distance from the median never shrinks as h grows.
      for (let j = 0; j < QUANTILES.length; j++) {
        if (j === 2) continue;
        let widest = 0;
        for (let h = 0; h < H; h++) {
          const row = rows[h] as number[];
          const dev = (row[j] as number) - (row[2] as number);
          if (Math.abs(dev) < widest) row[j] = (row[2] as number) + Math.sign(dev) * widest;
          else widest = Math.abs(dev);
        }
      }
    }
    const q = rows.map((dq) => {
      const row = dq.map((d, j) => price6(x + ((j === 0 || j === 4) ? SCALE_OUT : SCALE) * d));
      row.sort((a, b) => a - b);
      return row;
    });
    return { id: m.id, q };
  });
}

mkdirSync(OUTPUT_DIR, { recursive: true });
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  if (c.quantiles.length !== QUANTILES.length || c.quantiles.some((t, j) => t !== QUANTILES[j])) throw new Error(`${file} asks for quantiles ${JSON.stringify(c.quantiles)}, not ${JSON.stringify(QUANTILES)}`);
  const forecasts = forecastCase(c);
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ forecasts })}\n`);
}
