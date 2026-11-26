// Token Radar, model radar-3: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and every
// other pre-token protocol the snapshot carries: the early rows the radar exists to find. A protocol
// is pre-token when its record carries no token (no market cap, no CoinGecko id, no symbol); the
// live-token protocols are kept apart and shown at the market's own values, never mixed into the
// ranked board.
//
// Implied value is fitted from the snapshot's own record, in two parts the top of the field also
// separates, because a launch is worth something and a launch is not certain:
//
//   launch value = what a token would be worth if one launches. A log-linear curve fitted on the
//     snapshot's traded protocols: log10(market cap) from log10(TVL), with a shrunk category
//     effect and candidate terms (chain count, years listed, 7-day growth) that are kept only when
//     they lower the miss in BOTH blind tests — leave-one-out and walk-forward (older-listed
//     protocols price newer-listed ones). A control term, another protocol's growth, is tested the
//     same way and must not help. The flat median multiple is the baseline for both tests.
//   token odds   = the chance a token is recorded within 24 months, from the peers' own record:
//     a logistic model on the snapshot's protocols (age, the category's token share, size,
//     7-day growth), each term kept only when it lowers the Brier score in both tests —
//     ten-fold and walk-forward — against the base rate. The odds are the peers' record, not a
//     forecast: the page never says a token will launch.
//   implied      = launch value x token odds, with P25-P75 / P10-P90 from the fit's residual
//     spread. The printed ranges are backtested walk-forward: the share of real caps that fall
//     inside them is shown next to the stated 50% / 80%.
//
// Every one of the 758 protocols lands in exactly one accounting group, and the dashboard's
// integrity strip recomputes the board from board.json (ranks, totals, checksum, watchlist).
// Each farm plan ends in a costed verdict: FARM when the net beats $25 an hour, MARGINAL when
// it is positive under that, SKIP when it loses money — against a 4% T-bill for the same money.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  category_shrink: number;
  growth_floor: number;
  growth_cap: number;
  unknown_age_days: number;
  odds_window_days: number;
  odds_floor: number;
  odds_cap: number;
  drop_share: number;
  capital_charge_rate: number;
  tbill_rate: number;
  farm_hourly_bar: number;
  deposit_cap: number;
}

export const MODEL: ModelConstants = {
  category_shrink: 16,
  growth_floor: -40,
  growth_cap: 60,
  unknown_age_days: 365,
  odds_window_days: 730,
  odds_floor: 0.02,
  odds_cap: 0.98,
  drop_share: 0.1,
  capital_charge_rate: 0.02,
  tbill_rate: 0.04,
  farm_hourly_bar: 25,
  deposit_cap: 25_000,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 30;

/** One rung of a validation ladder: a term, its two blind misses, and whether it was kept. */
export interface LadderRow {
  term: string;
  loo_miss: number;
  wf_miss: number;
  kept: boolean;
}

/** The fitted launch-value model, with its validation, for the dashboard. */
export interface Validation {
  fit_n: number;
  wf_test_n: number;
  flat_loo_miss: number;
  flat_wf_miss: number;
  loo_miss: number;
  wf_miss: number;
  sigma_log10: number;
  range_p25_wf: number;
  range_p10_wf: number;
  range_n: number;
  brier_cv: number;
  brier_base_cv: number;
  brier_wf: number;
  brier_base_wf: number;
  value_ladder: LadderRow[];
  odds_ladder: LadderRow[];
  intercept: number;
  size_slope: number;
  chain_coef: number;
  age_coef: number;
  growth_coef: number;
  kept_terms: string[];
}

/** Where every one of the snapshot's protocols lands. */
export interface Accounting {
  ranked: number;
  priced_comps: number;
  token_no_cap: number;
  out_bridge: number;
  out_staking: number;
  out_exchange: number;
  out_versioned: number;
  out_other: number;
  total: number;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The costed verdict behind a farm plan. */
export interface FarmVerdict {
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  deposit_usd: number;
  hold_days: number;
  gas_usd: number;
  capital_charge_usd: number;
  drop_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  hours: number;
  tbill_usd: number;
  exit_tvl_usd: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  launch_value_usd: number;
  odds: number;
  implied_value_usd: number;
  p25_usd: number;
  p75_usd: number;
  p10_usd: number;
  p90_usd: number;
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  deposit_usd: number;
  hold_days: number;
  gas_usd: number;
  capital_charge_usd: number;
  drop_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  hours: number;
  tbill_usd: number;
  exit_tvl_usd: number;
  model: {
    log_tvl: number;
    log_chain: number;
    log_age: number;
    growth: number;
    category_effect: number;
    launch_value: number;
    odds: number;
    sigma_log10: number;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  launch_value_usd: number;
  odds: number;
  implied_value_usd: number;
  p25_usd: number;
  p75_usd: number;
  p10_usd: number;
  p90_usd: number;
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  deposit_usd: number;
  hold_days: number;
  gas_usd: number;
  capital_charge_usd: number;
  drop_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  hours: number;
  tbill_usd: number;
  exit_tvl_usd: number;
  log_tvl: number;
  log_chain: number;
  log_age: number;
  growth: number;
  category_effect: number;
  watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the fit and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  validation: Validation;
  accounting: Accounting;
  main_checksum: string;
  category_effects: Record<string, number>;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a list of numbers; 0 for an empty list. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The category a protocol is read under: its own category, or 'Other' when none. */
export function categoryOf(p: SnapshotProtocol): string {
  return p.category === null || p.category === '' ? 'Other' : p.category;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories the house's watchlist rule treats as a wrapped, staked or bridged product of a token that already trades. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Exchange names: a protocol beginning with one is that exchange's own product. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

/** A whole word wrapped, staked or staking anywhere in the name. */
const WRAPPED_WORD = /\bwrapped\b|\bstaked\b|\bstaking\b/i;

/**
 * Whether a protocol is a wrapped, staked or bridged product of a token that already trades, by the
 * same rule the house used to draw the watchlist: WBTC is Bitcoin on Ethereum, Binance staked ETH is
 * ETH in Binance's staking product, and neither is a protocol still waiting on a launch of its own.
 * The watchlist slugs are vetted by the house already, so this rule guards the early radar only.
 */
export function isExcludedProduct(p: SnapshotProtocol): boolean {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return true;
  if (WRAPPED_WORD.test(p.name)) return true;
  if (EXCHANGE_PREFIX.test(p.name)) return true;
  return false;
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool, and not a wrapped, staked or bridged product of a token that already trades. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name) && !isExcludedProduct(p);
}

/** Solve a small dense linear system by Gaussian elimination with partial pivoting; null when singular. */
export function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r]![col]!) > Math.abs(M[piv]![col]!)) piv = r;
    if (Math.abs(M[piv]![col]!) < 1e-12) return null;
    const tmp = M[col]!;
    M[col] = M[piv]!;
    M[piv] = tmp;
    for (let r = col + 1; r < n; r++) {
      const f = M[r]![col]! / M[col]![col]!;
      for (let c = col; c <= n; c++) M[r]![c]! -= f * M[col]![c]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r]![n]!;
    for (let c = r + 1; c < n; c++) s -= M[r]![c]! * x[c]!;
    x[r] = s / M[r]![r]!;
  }
  return x;
}

/** One traded protocol, reduced to the features the launch-value fit reads. */
export interface FitRow {
  slug: string;
  logTvl: number;
  logChain: number;
  logAge: number;
  growth: number;
  control: number;
  y: number;
  category: string;
  listedAt: string | null;
}

/** The feature vector a term set reads for one row: intercept, size, then the kept terms in order. */
function features(r: FitRow, terms: string[]): number[] {
  const v = [1, r.logTvl];
  for (const t of terms) {
    if (t === 'chain') v.push(r.logChain);
    else if (t === 'age') v.push(r.logAge);
    else if (t === 'growth') v.push(r.growth);
    else if (t === 'control') v.push(r.control);
  }
  return v;
}

/** Least squares on the training rows for one term set; null when the system is singular. */
function fitLinear(train: FitRow[], terms: string[]): number[] | null {
  const k = 2 + terms.length;
  const A: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const b = new Array<number>(k).fill(0);
  for (const r of train) {
    const x = features(r, terms);
    for (let i = 0; i < k; i++) {
      b[i]! += x[i]! * r.y;
      for (let j = 0; j < k; j++) A[i]![j]! += x[i]! * x[j]!;
    }
  }
  return solveLinear(A, b);
}

/** Shrunk category effects from training residuals: a category's mean residual, pulled toward zero by `shrink` pseudo-observations. */
function categoryEffects(train: FitRow[], predict: (r: FitRow) => number, shrink: number): Map<string, number> {
  const sums = new Map<string, { sum: number; n: number }>();
  for (const r of train) {
    const e = r.y - predict(r);
    const cur = sums.get(r.category) ?? { sum: 0, n: 0 };
    cur.sum += e;
    cur.n += 1;
    sums.set(r.category, cur);
  }
  const out = new Map<string, number>();
  for (const [c, v] of sums) out.set(c, (v.sum / v.n) * (v.n / (v.n + shrink)));
  return out;
}

/** A fitted launch-value model: its linear coefficients, its category effects, and its terms. */
export interface FittedLaunch {
  coef: number[];
  terms: string[];
  effects: Map<string, number>;
  predict: (r: FitRow) => number;
}

/** Fit the linear part plus shrunk category effects on the training rows. */
export function fitLaunch(train: FitRow[], terms: string[], model: ModelConstants = MODEL): FittedLaunch | null {
  const useCategory = terms.includes('category');
  const linearTerms = terms.filter((t) => t !== 'category');
  const coef = fitLinear(train, linearTerms);
  if (coef === null) return null;
  const linear = (r: FitRow): number => {
    const x = features(r, linearTerms);
    let s = 0;
    for (let i = 0; i < x.length; i++) s += coef[i]! * x[i]!;
    return s;
  };
  const effects = useCategory ? categoryEffects(train, linear, model.category_shrink) : new Map<string, number>();
  const predict = (r: FitRow): number => linear(r) + (effects.get(r.category) ?? 0);
  return { coef, terms, effects, predict };
}

/** The typical miss of a fitted model on held-out rows: the median of max(pred/actual, actual/pred). */
function typicalMiss(fitted: FittedLaunch, rows: FitRow[]): number {
  if (rows.length === 0) return Number.POSITIVE_INFINITY;
  const misses = rows.map((r) => Math.pow(10, Math.abs(fitted.predict(r) - r.y)));
  return median(misses);
}

/** The flat baseline's typical miss: every held-out row priced at the training median multiple. */
function flatMiss(train: FitRow[], test: FitRow[]): number {
  if (train.length === 0 || test.length === 0) return Number.POSITIVE_INFINITY;
  const ratios = train.map((r) => Math.pow(10, r.y - r.logTvl));
  const med = median(ratios);
  const misses = test.map((r) => {
    const pred = r.logTvl + Math.log10(med);
    return Math.pow(10, Math.abs(pred - r.y));
  });
  return median(misses);
}

/** Leave-one-out miss: each row held out once, the model refit without it. */
function looMiss(rows: FitRow[], terms: string[], model: ModelConstants = MODEL): number {
  const misses: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const train = rows.filter((_, j) => j !== i);
    const fitted = fitLaunch(train, terms, model);
    if (fitted === null) return Number.POSITIVE_INFINITY;
    misses.push(Math.pow(10, Math.abs(fitted.predict(rows[i]!) - rows[i]!.y)));
  }
  return median(misses);
}

/** Walk-forward miss: the older 60% by listing date fit, the newer 40% tested. Rows without a listing date are left out of this test. */
function wfMiss(rows: FitRow[], terms: string[], model: ModelConstants = MODEL): { miss: number; test: FitRow[]; fitted: FittedLaunch | null } {
  const dated = rows.filter((r) => r.listedAt !== null).sort((a, b) => (a.listedAt! < b.listedAt! ? -1 : 1));
  const cut = Math.floor(dated.length * 0.6);
  const train = dated.slice(0, cut);
  const test = dated.slice(cut);
  if (train.length < 10 || test.length < 5) return { miss: Number.POSITIVE_INFINITY, test, fitted: null };
  const fitted = fitLaunch(train, terms, model);
  if (fitted === null) return { miss: Number.POSITIVE_INFINITY, test, fitted: null };
  return { miss: typicalMiss(fitted, test), test, fitted };
}

/** The traded protocols the launch-value fit may learn from: a market cap and a TVL, and not a wrapped, staked, bridged or exchange product. */
export function fitRows(snapshot: Snapshot): FitRow[] {
  const asOf = snapshot.as_of;
  const sorted = [...snapshot.protocols].sort((a, b) => (a.slug < b.slug ? -1 : 1));
  const out: FitRow[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]!;
    if (isPreToken(p) || p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    if (p.category === 'CEX' || VERSIONED.test(p.name) || isExcludedProduct(p)) continue;
    const age = ageDays(asOf, p.listed_at);
    const ageYears = Math.max((age ?? MODEL.unknown_age_days) / 365, 0.05);
    const next = sorted[(i + 1) % sorted.length]!;
    out.push({
      slug: p.slug,
      logTvl: Math.log10(p.tvl_usd),
      logChain: Math.log10(Math.max(p.chains.length, 1)),
      logAge: Math.log10(ageYears),
      growth: Math.min(MODEL.growth_cap, Math.max(MODEL.growth_floor, finite(p.change_7d, 0))) / 100,
      control: Math.min(MODEL.growth_cap, Math.max(MODEL.growth_floor, finite(next.change_7d, 0))) / 100,
      y: Math.log10(p.mcap_usd),
      category: categoryOf(p),
      listedAt: p.listed_at,
    });
  }
  return out;
}

/** The launch-value validation: the term ladder, both blind misses, the range honesty, and the fitted coefficients. The odds validation comes from the snapshot and is merged in by the caller. A value term is kept when the two blind misses together fall by at least 1%. */
export function validateLaunch(
  rows: FitRow[],
  odds: { brier_cv: number; brier_base_cv: number; brier_wf: number; brier_base_wf: number; ladder: LadderRow[]; fitted: OddsModel },
  model: ModelConstants = MODEL,
): Validation {
  const ladder: LadderRow[] = [];
  let terms: string[] = [];
  let loo = looMiss(rows, terms, model);
  let wf = wfMiss(rows, terms, model).miss;
  // The flat baseline is the median multiple, not the fitted curve.
  const flatLooMiss = flatBaselineMiss(rows, 'loo');
  const flatWfMiss = flatBaselineMiss(rows, 'wf');
  for (const term of ['category', 'chain', 'age', 'growth', 'control']) {
    const trial = [...terms, term];
    const trialLoo = looMiss(rows, trial, model);
    const trialWf = wfMiss(rows, trial, model).miss;
    const kept = trialLoo + trialWf < (loo + wf) * 0.99;
    ladder.push({ term, loo_miss: round4(trialLoo), wf_miss: round4(trialWf), kept });
    if (kept) {
      terms = trial;
      loo = trialLoo;
      wf = trialWf;
    }
  }
  const fitted = fitLaunch(rows, terms, model)!;
  const residuals = rows.map((r) => r.y - fitted.predict(r));
  const sigma = Math.sqrt(residuals.reduce((s, e) => s + e * e, 0) / Math.max(residuals.length, 1));
  // Range honesty, walk-forward: the share of newer caps inside the printed bands.
  const wfRun = wfMiss(rows, terms, model);
  let inP25 = 0;
  let inP10 = 0;
  let rangeN = 0;
  if (wfRun.fitted !== null) {
    const dated = rows.filter((r) => r.listedAt !== null).sort((a, b) => (a.listedAt! < b.listedAt! ? -1 : 1));
    const trainRows = dated.slice(0, Math.floor(dated.length * 0.6));
    const trainSigma = Math.sqrt(trainRows.reduce((s, r) => s + Math.pow(r.y - wfRun.fitted!.predict(r), 2), 0) / Math.max(trainRows.length, 1));
    for (const r of wfRun.test) {
      const pred = wfRun.fitted.predict(r);
      const lo25 = pred - 0.674 * trainSigma;
      const hi25 = pred + 0.674 * trainSigma;
      const lo10 = pred - 1.282 * trainSigma;
      const hi10 = pred + 1.282 * trainSigma;
      if (r.y >= lo25 && r.y <= hi25) inP25++;
      if (r.y >= lo10 && r.y <= hi10) inP10++;
      rangeN++;
    }
  }
  return {
    fit_n: rows.length,
    wf_test_n: wfRun.test.length,
    flat_loo_miss: round4(flatLooMiss),
    flat_wf_miss: round4(flatWfMiss),
    loo_miss: round4(loo),
    wf_miss: round4(wf),
    sigma_log10: round4(sigma),
    range_p25_wf: rangeN === 0 ? 0 : round4(inP25 / rangeN),
    range_p10_wf: rangeN === 0 ? 0 : round4(inP10 / rangeN),
    range_n: rangeN,
    brier_cv: odds.brier_cv,
    brier_base_cv: odds.brier_base_cv,
    brier_wf: odds.brier_wf,
    brier_base_wf: odds.brier_base_wf,
    value_ladder: ladder,
    odds_ladder: odds.ladder,
    intercept: fitted.coef[0]!,
    size_slope: fitted.coef[1]!,
    chain_coef: coefFor(fitted, terms, 'chain'),
    age_coef: coefFor(fitted, terms, 'age'),
    growth_coef: coefFor(fitted, terms, 'growth'),
    kept_terms: terms,
  };
}

/** The coefficient one term carries in a fitted model, or 0 when the term was not kept. Coefficients run [intercept, size slope, then one per kept linear term in order]. */
function coefFor(fitted: FittedLaunch, terms: string[], term: string): number {
  const linearTerms = terms.filter((t) => t !== 'category');
  const at = linearTerms.indexOf(term);
  if (at < 0) return 0;
  return fitted.coef[2 + at]!;
}

/** The flat baseline's miss under one test: the median multiple, leave-one-out or walk-forward. */
function flatBaselineMiss(rows: FitRow[], test: 'loo' | 'wf'): number {
  if (test === 'loo') {
    const misses: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      const train = rows.filter((_, j) => j !== i);
      misses.push(flatMiss(train, [rows[i]!]));
    }
    return median(misses);
  }
  const dated = rows.filter((r) => r.listedAt !== null).sort((a, b) => (a.listedAt! < b.listedAt! ? -1 : 1));
  const cut = Math.floor(dated.length * 0.6);
  return flatMiss(dated.slice(0, cut), dated.slice(cut));
}

/** A small deterministic hash of a string, for the ten-fold split. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The odds features for one protocol: log age, the category's shrunk token share, log TVL, 7-day growth. */
const ODDS_FEATURES = ['age', 'category', 'size', 'growth'] as const;

function oddsFeatures(p: SnapshotProtocol, asOf: string, catShare: Map<string, number>, ageOverride?: number): number[] {
  const age = ageOverride ?? ageDays(asOf, p.listed_at) ?? MODEL.unknown_age_days;
  const ageYears = Math.max(age, 30) / 365;
  return [
    Math.log10(ageYears),
    catShare.get(categoryOf(p)) ?? 0.5,
    Math.log10(Math.max(p.tvl_usd, 1)),
    Math.min(MODEL.growth_cap, Math.max(MODEL.growth_floor, finite(p.change_7d, 0))) / 100,
  ];
}

/** A fitted token-odds model: logistic regression on the peers, with its standardisation. */
export interface OddsModel {
  terms: string[];
  beta: number[];
  mean: number[];
  sd: number[];
  catShare: Map<string, number>;
  baseRate: number;
}

/** Fit the logistic odds model on a training set, with only the named terms active. Gradient descent, fixed steps, no randomness. */
export function fitOddsModel(train: SnapshotProtocol[], terms: string[], asOf: string): OddsModel {
  const baseRate = train.filter((p) => !isPreToken(p)).length / Math.max(train.length, 1);
  const byCat = new Map<string, { n: number; t: number }>();
  for (const p of train) {
    const c = categoryOf(p);
    const cur = byCat.get(c) ?? { n: 0, t: 0 };
    cur.n++;
    if (!isPreToken(p)) cur.t++;
    byCat.set(c, cur);
  }
  const catShare = new Map<string, number>();
  for (const [c, v] of byCat) catShare.set(c, (v.t + 5 * baseRate) / (v.n + 5));
  const raw = train.map((p) => oddsFeatures(p, asOf, catShare));
  const mean = [0, 1, 2, 3].map((i) => raw.reduce((s, r) => s + r[i]!, 0) / Math.max(raw.length, 1));
  const sd = [0, 1, 2, 3].map((i) => {
    const m = mean[i]!;
    const v = raw.reduce((s, r) => s + (r[i]! - m) * (r[i]! - m), 0) / Math.max(raw.length, 1);
    return Math.max(Math.sqrt(v), 1e-6);
  });
  const termIdx = terms.map((t) => ODDS_FEATURES.indexOf(t as (typeof ODDS_FEATURES)[number]));
  const k = termIdx.length;
  const beta = new Array<number>(k + 1).fill(0);
  const n = train.length;
  const lr = 0.5;
  const lambda = 1.0;
  for (let it = 0; it < 300; it++) {
    const grad = new Array<number>(k + 1).fill(0);
    for (let i = 0; i < n; i++) {
      const z = [1, ...termIdx.map((j) => (raw[i]![j]! - mean[j]!) / sd[j]!)];
      let s = 0;
      for (let j = 0; j <= k; j++) s += beta[j]! * z[j]!;
      s = Math.max(-30, Math.min(30, s));
      const pred = 1 / (1 + Math.exp(-s));
      const y = isPreToken(train[i]!) ? 0 : 1;
      const err = pred - y;
      for (let j = 0; j <= k; j++) grad[j]! += err * z[j]!;
    }
    for (let j = 0; j <= k; j++) {
      const reg = j === 0 ? 0 : lambda * beta[j]!;
      beta[j]! -= (lr / n) * (grad[j]! + reg);
    }
  }
  return { terms, beta, mean, sd, catShare, baseRate };
}

/** The model's predicted chance that a protocol has a token, at one age. */
export function oddsPredict(m: OddsModel, p: SnapshotProtocol, asOf: string, ageOverride?: number): number {
  const raw = oddsFeatures(p, asOf, m.catShare, ageOverride);
  const termIdx = m.terms.map((t) => ODDS_FEATURES.indexOf(t as (typeof ODDS_FEATURES)[number]));
  const z = [1, ...termIdx.map((j) => (raw[j]! - m.mean[j]!) / m.sd[j]!)];
  let s = 0;
  for (let j = 0; j < z.length; j++) s += m.beta[j]! * z[j]!;
  s = Math.max(-30, Math.min(30, s));
  return 1 / (1 + Math.exp(-s));
}

/** The token odds for one protocol: the chance of a token within the window, given none by now. */
export function tokenOddsFromModel(m: OddsModel, p: SnapshotProtocol, asOf: string, model: ModelConstants = MODEL): number {
  const age = ageDays(asOf, p.listed_at) ?? model.unknown_age_days;
  const pNow = oddsPredict(m, p, asOf, age);
  const pLater = oddsPredict(m, p, asOf, age + model.odds_window_days);
  const odds = (pLater - pNow) / (1 - pNow);
  if (!Number.isFinite(odds)) return model.odds_floor;
  return Math.min(model.odds_cap, Math.max(model.odds_floor, odds));
}

/** Brier score of an odds model on a test set: the mean squared gap between the predicted chance and the token actually recorded. */
function brierOfModel(m: OddsModel, test: SnapshotProtocol[], asOf: string): number {
  if (test.length === 0) return 0;
  let sum = 0;
  for (const p of test) {
    const pred = oddsPredict(m, p, asOf);
    const actual = isPreToken(p) ? 0 : 1;
    sum += (pred - actual) * (pred - actual);
  }
  return sum / test.length;
}

/** Brier score of the base rate on a test set. */
function brierBase(train: SnapshotProtocol[], test: SnapshotProtocol[]): number {
  if (test.length === 0) return 0;
  const base = train.filter((p) => !isPreToken(p)).length / Math.max(train.length, 1);
  let sum = 0;
  for (const p of test) {
    const actual = isPreToken(p) ? 0 : 1;
    sum += (base - actual) * (base - actual);
  }
  return sum / test.length;
}

/** Ten-fold Brier: folds by slug hash, each fold's model fitted on the other nine. */
function brierCv(protocols: SnapshotProtocol[], terms: string[], asOf: string): number {
  let sum = 0;
  let n = 0;
  for (let fold = 0; fold < 10; fold++) {
    const test = protocols.filter((p) => fnv1a(p.slug) % 10 === fold);
    const train = protocols.filter((p) => fnv1a(p.slug) % 10 !== fold);
    if (test.length === 0) continue;
    sum += brierOfModel(fitOddsModel(train, terms, asOf), test, asOf) * test.length;
    n += test.length;
  }
  return n === 0 ? 0 : sum / n;
}

/** Walk-forward Brier: the model fitted on protocols listed more than a year before the snapshot predicts the token status of protocols listed within the last year. */
function brierWf(protocols: SnapshotProtocol[], terms: string[], asOf: string): number {
  const cutoff = Date.parse(`${asOf}T00:00:00Z`) - 365 * DAY_MS;
  const train = protocols.filter((p) => p.listed_at !== null && Date.parse(`${p.listed_at}T00:00:00Z`) < cutoff);
  const test = protocols.filter((p) => p.listed_at !== null && Date.parse(`${p.listed_at}T00:00:00Z`) >= cutoff);
  if (train.length < 10 || test.length === 0) return 0;
  return brierOfModel(fitOddsModel(train, terms, asOf), test, asOf);
}

/** Ten-fold base-rate Brier, for the same folds. */
function brierBaseCv(protocols: SnapshotProtocol[]): number {
  let sum = 0;
  let n = 0;
  for (let fold = 0; fold < 10; fold++) {
    const test = protocols.filter((p) => fnv1a(p.slug) % 10 === fold);
    const train = protocols.filter((p) => fnv1a(p.slug) % 10 !== fold);
    if (test.length === 0) continue;
    sum += brierBase(train, test) * test.length;
    n += test.length;
  }
  return n === 0 ? 0 : sum / n;
}

/** Walk-forward base-rate Brier, for the same split. */
function brierBaseWf(protocols: SnapshotProtocol[], asOf: string): number {
  const cutoff = Date.parse(`${asOf}T00:00:00Z`) - 365 * DAY_MS;
  const train = protocols.filter((p) => p.listed_at !== null && Date.parse(`${p.listed_at}T00:00:00Z`) < cutoff);
  const test = protocols.filter((p) => p.listed_at !== null && Date.parse(`${p.listed_at}T00:00:00Z`) >= cutoff);
  return brierBase(train, test);
}

/** The token-odds validation from the snapshot itself: term selection by Brier, both tests. An odds term is kept when both Brier scores fall. */
export function validateOddsSnapshot(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { brier_cv: number; brier_base_cv: number; brier_wf: number; brier_base_wf: number; ladder: LadderRow[]; fitted: OddsModel } {
  void model;
  const asOf = snapshot.as_of;
  const protocols = snapshot.protocols;
  const ladder: LadderRow[] = [];
  let terms: string[] = [];
  let cv = brierCv(protocols, terms, asOf);
  let wf = brierWf(protocols, terms, asOf);
  const baseCv = brierBaseCv(protocols);
  const baseWf = brierBaseWf(protocols, asOf);
  for (const term of [...ODDS_FEATURES]) {
    const trial = [...terms, term];
    const trialCv = brierCv(protocols, trial, asOf);
    const trialWf = brierWf(protocols, trial, asOf);
    const kept = trialCv < cv && trialWf < wf;
    ladder.push({ term, loo_miss: round4(trialCv), wf_miss: round4(trialWf), kept });
    if (kept) {
      terms = trial;
      cv = trialCv;
      wf = trialWf;
    }
  }
  const fitted = fitOddsModel(protocols, terms, asOf);
  return {
    brier_cv: round4(cv),
    brier_base_cv: round4(baseCv),
    brier_wf: round4(wf),
    brier_base_wf: round4(baseWf),
    ladder,
    fitted,
  };
}

/** The deposit tiers a farm plan may use, in dollars. */
export const DEPOSIT_TIERS = [1000, 1500, 4000, 6500, 10000, 15000, 20000, 25000];

/** Chains whose transactions are cheap enough to treat as layer-2 gas. */
const L2_CHAINS = new Set(['Arbitrum', 'Base', 'Optimism', 'Polygon', 'zkSync Era', 'Linea', 'Blast', 'Scroll', 'Mantle', 'Mode', 'Starknet', 'Avalanche']);

/** One transaction's gas on a chain, in dollars. */
export function txCost(chain: string): number {
  if (chain === 'Solana') return 0.05;
  if (chain === 'Ethereum') return 3.2;
  if (L2_CHAINS.has(chain)) return 0.5;
  if (chain === 'Bitcoin') return 2;
  return 1;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window, capped at 105 days. */
export function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  return Math.min(105, Math.max(28, Math.round(age * 0.65)));
}

/** A dollar amount with at most two decimals, trailing zeros trimmed. */
export function money(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
}

/** The costed verdict for one farm: the smallest deposit that clears $25 an hour, else the deposit with the best net. */
export function farmVerdict(p: SnapshotProtocol, implied: number, age: number | null, model: ModelConstants = MODEL): FarmVerdict {
  const chain = chainOf(p);
  const hold = holdDaysFor(age);
  const weeks = Math.max(1, Math.round(hold / 7));
  const gas = Math.round(txCost(chain) * (4 + weeks) * 100) / 100;
  const hours = Math.round((1.0 + hold * 0.012) * 100) / 100;
  const exitTvl = Math.round(p.tvl_usd * 0.7);
  let best: FarmVerdict | null = null;
  for (const deposit of DEPOSIT_TIERS) {
    if (deposit > model.deposit_cap) break;
    const charge = Math.round(deposit * model.capital_charge_rate * (hold / 365) * 100) / 100;
    const drop = Math.max(0, Math.round((implied * model.drop_share * deposit) / (p.tvl_usd + deposit)));
    const net = Math.round((drop - gas - charge) * 100) / 100;
    const perHour = Math.round((net / hours) * 100) / 100;
    const tbill = Math.round(deposit * model.tbill_rate * (hold / 365) * 100) / 100;
    const v: FarmVerdict = {
      verdict: 'SKIP',
      deposit_usd: deposit,
      hold_days: hold,
      gas_usd: gas,
      capital_charge_usd: charge,
      drop_usd: drop,
      net_usd: net,
      net_per_hour_usd: perHour,
      hours,
      tbill_usd: tbill,
      exit_tvl_usd: exitTvl,
    };
    if (perHour >= model.farm_hourly_bar) {
      return { ...v, verdict: 'FARM' };
    }
    if (best === null || net > best.net_usd) best = v;
  }
  if (best !== null && best.net_usd > 0) return { ...best, verdict: 'MARGINAL' };
  return { ...best!, verdict: 'SKIP' };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** Gas for one weekly action and for the first setup, from the protocol's first chain. */
function gasFor(chain: string): { week: string; setup: string } {
  const tx = txCost(chain);
  if (chain === 'Solana') return { week: 'about $0.05 of gas a week', setup: 'about $1 of gas' };
  if (chain === 'Ethereum') return { week: 'about $5 of gas a week', setup: 'about $8 of gas' };
  if (L2_CHAINS.has(chain)) return { week: 'about $0.50 of gas a week', setup: 'about $2 of gas' };
  if (chain === 'Bitcoin') return { week: 'about $2 of network fees a week', setup: 'about $5 of network fees' };
  void tx;
  return { week: 'about $1 of gas a week', setup: 'about $3 of gas' };
}

/** The category's first action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trad')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('index')) return `Buy $${capital} of the index token on ${chain} through ${name} and hold it.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's second action: a different feature of the same protocol, used once a week. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const small = Math.max(10, Math.round(capital / 5));
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow $${small} against the deposit on ${name} and repay it within the week, so the record shows both sides of the position.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Swap $${small} in ${name}'s main pool once a week, in both directions over time, so the volume is real.`;
  if (c.includes('bridge')) return `Bridge $${small} back the other way through ${name} once, so the activity is not a single one-way transfer.`;
  if (c.includes('staking') || c.includes('restak')) return `Restake the rewards the ${name} position earns instead of withdrawing them.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trad')) return `Close the hedge on ${name} and open a fresh one once a week, keeping the margin in place.`;
  if (c.includes('prediction')) return `Settle one market a week on ${name} and open the next, keeping the balance funded.`;
  if (c.includes('curator') || c.includes('allocator')) return `Move $${small} of the deposit into a second vault of ${name} on ${chain}.`;
  if (c.includes('stable')) return `Use the minted stable asset in one payment or swap a week through ${name}, then return it.`;
  if (c.includes('rwa')) return `Claim the yield the ${name} asset accrues once a week instead of letting it sit.`;
  if (c.includes('insurance')) return `Open a second, smaller cover on a different risk ${name} prices on ${chain}.`;
  if (c.includes('index')) return `Rebalance the ${name} index position once a month, adding $${small} when the allocation drifts.`;
  return `Use one more feature of ${name} each week, such as a swap, a vote or a deposit, and keep a note of it.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time, ending in the
 * costed budget. The plan is derived from the protocol's own record (category, chains, TVL, age),
 * the costed verdict (deposit, hold, gas, drop, net) and the implied value, never from a
 * hand-written list of names. The page's copy of this function takes a board row and reads the
 * same stored fields, so the two agree on every row.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, v: FarmVerdict, implied: number): FarmStep[] {
  const chain = chainOf(p);
  const gas = gasFor(chain);
  const counted = age === null ? 365 : Math.min(age, 365);
  const pct = Math.round((v.hold_days / counted) * 100);
  const weeks = Math.max(1, Math.round(v.hold_days / 7));
  const sharePct = money((v.deposit_usd / (p.tvl_usd + v.deposit_usd)) * 100);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `under $3 of gas for the first transaction`,
      time: '5 minutes',
    },
    {
      text: actionFor(p, v.deposit_usd, chain),
      cost: `$${v.deposit_usd} of capital and ${gas.setup}`,
      time: '15 minutes to set up',
    },
    {
      text: secondActionFor(p, v.deposit_usd, chain),
      cost: `$${Math.max(10, Math.round(v.deposit_usd / 5))} of capital and ${gas.week}`,
      time: '10 minutes a week',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and check the protocol's own points page for what it records.`,
      cost: gas.week,
      time: '10 minutes a week',
    },
    {
      text: `Leave early if TVL drops under $${v.exit_tvl_usd.toLocaleString('en-US')} (30% below today), a risk limit is hit, or a token is on record: claim only from a link ${p.name} publishes, never pay to claim.`,
      cost: 'no fee to check',
      time: '5 minutes a week',
    },
    {
      text: `On day ${v.hold_days}, unwind the position and send the funds back to the exchange. ${v.hold_days} days is about ${pct}% of the counted time (${counted} days tracked, a year at most); past this point a week adds less drop than its $${money(txCost(chain) + v.capital_charge_usd / weeks)} of charge and gas.`,
      cost: `$${money(v.gas_usd)} of gas to exit`,
      time: '20 minutes',
    },
    {
      text: `Budget: $${v.deposit_usd.toLocaleString('en-US')} for ${v.hold_days} days. Gas $${money(v.gas_usd)} and a 2% capital charge $${money(v.capital_charge_usd)}. Expected drop $${v.drop_usd.toLocaleString('en-US')} (10% of $${implied.toLocaleString('en-US')} for a ${sharePct}% share of $${p.tvl_usd.toLocaleString('en-US')} TVL). Net $${money(v.net_usd)}, $${money(v.net_per_hour_usd)} an hour — ${v.verdict}. The same money in a 4% T-bill earns $${money(v.tbill_usd)}.`,
      cost: `$${money(v.gas_usd + v.capital_charge_usd)} of costs`,
      time: `${money(v.hours)} hours of work`,
    },
  ];
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** Where every protocol lands, in exactly one group, summing to the snapshot's total. */
export function accountingOf(snapshot: Snapshot, boardSlugs: Set<string>, fitSlugs: Set<string>): Accounting {
  let ranked = 0;
  let priced = 0;
  let noCap = 0;
  let bridge = 0;
  let staking = 0;
  let exchange = 0;
  let versioned = 0;
  let other = 0;
  for (const p of snapshot.protocols) {
    if (boardSlugs.has(p.slug)) {
      ranked++;
      continue;
    }
    if (fitSlugs.has(p.slug)) {
      priced++;
      continue;
    }
    if (!isPreToken(p)) {
      noCap++;
      continue;
    }
    if (p.category === 'Bridge' || p.category === 'Canonical Bridge') bridge++;
    else if (p.category === 'Liquid Staking' || p.category === 'Liquid Restaking' || p.category === 'Restaked BTC') staking++;
    else if (p.category === 'CEX' || EXCHANGE_PREFIX.test(p.name) || WRAPPED_WORD.test(p.name)) exchange++;
    else if (VERSIONED.test(p.name)) versioned++;
    else other++;
  }
  return {
    ranked,
    priced_comps: priced,
    token_no_cap: noCap,
    out_bridge: bridge,
    out_staking: staking,
    out_exchange: exchange,
    out_versioned: versioned,
    out_other: other,
    total: snapshot.protocols.length,
  };
}

/** The protocols the board ranks, strongest first, with ranks 1..n, plus the fit and the accounting. */
export function buildBoard(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { board: BoardRow[]; validation: Validation; accounting: Accounting; effects: Map<string, number> } {
  const fit = fitRows(snapshot);
  const oddsValidation = validateOddsSnapshot(snapshot, model);
  const validation = validateLaunch(fit, oddsValidation, model);
  const fitted = fitLaunch(fit, validation.kept_terms, model)!;
  const oddsModel = oddsValidation.fitted;
  const sigma = validation.sigma_log10;
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, not just the largest few. The floor
  // is never the whole board: the radar exists to find these.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const ageYears = Math.max((age ?? model.unknown_age_days) / 365, 0.05);
    const fr: FitRow = {
      slug: p.slug,
      logTvl: Math.log10(Math.max(p.tvl_usd, 1)),
      logChain: Math.log10(Math.max(p.chains.length, 1)),
      logAge: Math.log10(ageYears),
      growth: Math.min(model.growth_cap, Math.max(model.growth_floor, finite(p.change_7d, 0))) / 100,
      control: 0,
      y: 0,
      category: categoryOf(p),
      listedAt: p.listed_at,
    };
    const launch = Math.pow(10, fitted.predict(fr));
    const odds = tokenOddsFromModel(oddsModel, p, snapshot.as_of, model);
    const implied = Math.max(1, Math.round(launch * odds));
    const band = (z: number): number => Math.max(1, Math.round(implied * Math.pow(10, z * sigma)));
    const verdict = farmVerdict(p, implied, age, model);
    return { p, age, fr, launch, odds, implied, p25: band(-0.674), p75: band(0.674), p10: band(-1.282), p90: band(1.282), verdict };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const board: BoardRow[] = scored.map((s, i) => {
    const steps = farmSteps(s.p, s.age, s.verdict, s.implied).map(stepText);
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: s.age,
      launch_value_usd: Math.max(1, Math.round(s.launch)),
      odds: round4(s.odds),
      implied_value_usd: s.implied,
      p25_usd: s.p25,
      p75_usd: s.p75,
      p10_usd: s.p10,
      p90_usd: s.p90,
      verdict: s.verdict.verdict,
      deposit_usd: s.verdict.deposit_usd,
      hold_days: s.verdict.hold_days,
      gas_usd: s.verdict.gas_usd,
      capital_charge_usd: s.verdict.capital_charge_usd,
      drop_usd: s.verdict.drop_usd,
      net_usd: s.verdict.net_usd,
      net_per_hour_usd: s.verdict.net_per_hour_usd,
      hours: s.verdict.hours,
      tbill_usd: s.verdict.tbill_usd,
      exit_tvl_usd: s.verdict.exit_tvl_usd,
      model: {
        // Full precision, not rounded: the page recomputes this row from these same numbers, and
        // a rounded feature would make its recompute differ by dollars and look stale.
        log_tvl: s.fr.logTvl,
        log_chain: s.fr.logChain,
        log_age: s.fr.logAge,
        growth: s.fr.growth,
        category_effect: fitted.effects.get(s.fr.category) ?? 0,
        launch_value: s.launch,
        odds: s.odds,
        sigma_log10: sigma,
      },
      farm_steps: steps,
    };
  });
  const accounting = accountingOf(snapshot, new Set(board.map((r) => r.slug)), new Set(fit.map((r) => r.slug)));
  return { board, validation, accounting, effects: fitted.effects };
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. The odds stay full precision: the page recomputes implied value from them, and a rounded odds would make its recompute differ by dollars. */
export function radarRow(row: BoardRow, watchlist: boolean): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    launch_value_usd: row.launch_value_usd,
    odds: row.model.odds,
    implied_value_usd: row.implied_value_usd,
    p25_usd: row.p25_usd,
    p75_usd: row.p75_usd,
    p10_usd: row.p10_usd,
    p90_usd: row.p90_usd,
    verdict: row.verdict,
    deposit_usd: row.deposit_usd,
    hold_days: row.hold_days,
    gas_usd: row.gas_usd,
    capital_charge_usd: row.capital_charge_usd,
    drop_usd: row.drop_usd,
    net_usd: row.net_usd,
    net_per_hour_usd: row.net_per_hour_usd,
    hours: row.hours,
    tbill_usd: row.tbill_usd,
    exit_tvl_usd: row.exit_tvl_usd,
    log_tvl: row.model.log_tvl,
    log_chain: row.model.log_chain,
    log_age: row.model.log_age,
    growth: row.model.growth,
    category_effect: row.model.category_effect,
    watchlist,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL, mainChecksum = ''): { board: BoardRow[]; radar: RadarData } {
  const { board, validation, accounting, effects } = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const category_effects: Record<string, number> = {};
  for (const [c, e] of [...effects.entries()].sort()) category_effects[c] = e;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    validation,
    accounting,
    main_checksum: mainChecksum,
    category_effects,
    rows: board.map((r) => radarRow(r, snapshot.watchlist.includes(r.slug))),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!(r.odds >= 0.02 && r.odds <= 0.98)) return `${r.slug} has odds ${r.odds}`;
    if (!(r.p10_usd <= r.p25_usd && r.p25_usd <= r.implied_value_usd && r.implied_value_usd <= r.p75_usd && r.p75_usd <= r.p90_usd)) {
      return `${r.slug} has a broken range ${r.p10_usd}/${r.p25_usd}/${r.implied_value_usd}/${r.p75_usd}/${r.p90_usd}`;
    }
    if (r.verdict !== 'FARM' && r.verdict !== 'MARGINAL' && r.verdict !== 'SKIP') return `${r.slug} has verdict ${r.verdict}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
