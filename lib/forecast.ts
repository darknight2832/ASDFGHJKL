import type { SeriesPoint } from "./analytics";

export type ForecastPoint = {
  date: string;
  value: number;
  upper?: number;
  lower?: number;
};

const regression = (values: number[]) => {
  const n = values.length;
  if (n < 2) return undefined;
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
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
};

const standardDeviation = (values: number[]) => {
  if (values.length < 2) return undefined;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const forecastLinear = (series: SeriesPoint[], horizon: number) => {
  if (series.length < 2 || horizon <= 0) return [] as ForecastPoint[];
  const sorted = [...series].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const values = sorted.map((point) => point.value);
  const lookback = Math.min(values.length, 90);
  const recentValues = values.slice(-lookback);
  const model = regression(recentValues);
  if (!model) return [];

  const residuals = recentValues.map((value, idx) => value - (model.intercept + model.slope * idx));
  const sigma = standardDeviation(residuals) ?? 0;

  const lastDate = new Date(sorted[sorted.length - 1].date);
  const startIndex = recentValues.length - 1;

  const forecast: ForecastPoint[] = [];
  for (let i = 1; i <= horizon; i += 1) {
    const x = startIndex + i;
    const value = model.intercept + model.slope * x;
    const band = 1.96 * sigma;
    forecast.push({
      date: addDays(lastDate, i).toISOString().slice(0, 10),
      value,
      upper: value + band,
      lower: value - band
    });
  }

  return forecast;
};
