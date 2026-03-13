export type SeriesPoint = {
  date: string;
  value: number;
};

export type Analytics = {
  latest: number;
  change7?: number;
  change30?: number;
  change90?: number;
  ma7?: number;
  ma30?: number;
  ma90?: number;
  volatility?: number;
  rsi14?: number;
  trendSlope?: number;
  drawdown?: number;
  support?: number;
  resistance?: number;
  signal: {
    label: string;
    score: number;
    reason: string;
  };
};

const sortSeries = (series: SeriesPoint[]) =>
  [...series].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

const average = (values: number[]) =>
  values.length === 0 ? undefined : values.reduce((sum, v) => sum + v, 0) / values.length;

const movingAverage = (values: number[], window: number) => {
  if (values.length < window) return undefined;
  const slice = values.slice(values.length - window);
  return average(slice);
};

const percentChange = (latest: number, previous?: number) => {
  if (previous === undefined || previous === 0) return undefined;
  return (latest - previous) / previous;
};

const standardDeviation = (values: number[]) => {
  if (values.length < 2) return undefined;
  const mean = average(values);
  if (mean === undefined) return undefined;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
};

const calcRSI = (values: number[], period = 14) => {
  if (values.length <= period) return undefined;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }
  if (gains + losses === 0) return undefined;
  const rs = losses === 0 ? 100 : gains / losses;
  return 100 - 100 / (1 + rs);
};

const linearRegressionSlope = (values: number[]) => {
  if (values.length < 2) return undefined;
  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i += 1) {
    const x = i;
    const y = values[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return undefined;
  return (n * sumXY - sumX * sumY) / denominator;
};

const percentile = (values: number[], p: number) => {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  const weight = idx - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const maxDrawdown = (values: number[]) => {
  if (values.length < 2) return undefined;
  let peak = values[0];
  let maxDd = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = (v - peak) / peak;
    if (dd < maxDd) maxDd = dd;
  }
  return maxDd;
};

export const computeAnalytics = (series: SeriesPoint[]): Analytics => {
  const sorted = sortSeries(series);
  const values = sorted.map((point) => point.value);
  const latest = values[values.length - 1];
  const change7 = percentChange(latest, values[values.length - 8]);
  const change30 = percentChange(latest, values[values.length - 31]);
  const change90 = percentChange(latest, values[values.length - 91]);

  const ma7 = movingAverage(values, 7);
  const ma30 = movingAverage(values, 30);
  const ma90 = movingAverage(values, 90);

  const returns = values
    .slice(1)
    .map((value, idx) => (value - values[idx]) / values[idx]);
  const dailyVol = standardDeviation(returns);
  const volatility = dailyVol === undefined ? undefined : dailyVol * Math.sqrt(252);

  const rsi14 = calcRSI(values, 14);
  const slope = linearRegressionSlope(values.slice(-90));

  const support = percentile(values.slice(-120), 0.2);
  const resistance = percentile(values.slice(-120), 0.8);

  const drawdown = maxDrawdown(values);

  let signal = {
    label: "Neutral",
    score: 0,
    reason: "Price is close to its recent average with no strong momentum signal."
  };

  if (ma30 !== undefined && rsi14 !== undefined) {
    if (rsi14 < 35 && latest < ma30 * 0.98) {
      signal = {
        label: "Potential Value Zone",
        score: 0.7,
        reason: "RSI is oversold and price is below the 30-day average."
      };
    } else if (rsi14 > 70 && latest > ma30 * 1.03) {
      signal = {
        label: "Extended",
        score: -0.6,
        reason: "RSI is overbought and price is well above the 30-day average."
      };
    } else if (slope !== undefined && slope > 0 && latest > ma30) {
      signal = {
        label: "Uptrend",
        score: 0.35,
        reason: "Trend slope is positive and price is above the 30-day average."
      };
    } else if (slope !== undefined && slope < 0 && latest < ma30) {
      signal = {
        label: "Downtrend",
        score: -0.35,
        reason: "Trend slope is negative and price is below the 30-day average."
      };
    }
  }

  return {
    latest,
    change7,
    change30,
    change90,
    ma7,
    ma30,
    ma90,
    volatility,
    rsi14,
    trendSlope: slope,
    drawdown,
    support,
    resistance,
    signal
  };
};

export const formatPercent = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
};

export const formatNumber = (value?: number, decimals = 2) => {
  if (value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(decimals);
};
