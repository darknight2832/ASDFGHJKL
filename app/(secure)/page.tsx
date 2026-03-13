"use client";

import { useEffect, useMemo, useState } from "react";
import { METAL_CATALOG, METAL_BY_ID, DEFAULT_METAL_ID } from "@/lib/metal";
import { computeAnalytics, formatNumber, formatPercent } from "@/lib/analytics";
import { forecastLinear } from "@/lib/forecast";

type SeriesPoint = {
  date: string;
  value: number;
};

type Seller = {
  title?: string;
  price?: string;
  extracted_price?: number;
  link?: string;
  source?: string;
  delivery?: string;
  rating?: number;
  reviews?: number;
};

type SessionInfo = {
  workspaceId: string;
  email: string;
  workspaceName?: string;
};

const rangeOptions = [90, 180, 365, 730];

const statusBadgeClass = (label: string) => {
  if (label === "Potential Value Zone" || label === "Uptrend") return "badge success";
  if (label === "Extended" || label === "Downtrend") return "badge warn";
  return "badge neutral";
};

const LineChart = ({
  series,
  forecast
}: {
  series: SeriesPoint[];
  forecast: Array<SeriesPoint & { upper?: number; lower?: number }>;
}) => {
  if (!series.length) {
    return <div className="small">No data yet. Run analysis to see the chart.</div>;
  }

  const actualPoints = series.map((point, idx) => ({ x: idx, y: point.value }));
  const forecastPoints = forecast.map((point, idx) => ({
    x: series.length - 1 + idx + 1,
    y: point.value,
    upper: point.upper,
    lower: point.lower
  }));

  const allPoints = [...actualPoints, ...forecastPoints];
  const xMax = allPoints[allPoints.length - 1].x || 1;
  const yValues = allPoints.map((point) => point.y);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const padding = (yMax - yMin) * 0.1 || 1;

  const scaleX = (x: number) => (x / xMax) * 1000;
  const scaleY = (y: number) => 300 - ((y - (yMin - padding)) / (yMax - yMin + padding * 2)) * 300;

  const pathFromPoints = (points: Array<{ x: number; y: number }>) =>
    points
      .map((point, idx) => `${idx === 0 ? "M" : "L"}${scaleX(point.x)} ${scaleY(point.y)}`)
      .join(" ");

  const actualPath = pathFromPoints(actualPoints);
  const forecastPath = forecastPoints.length ? pathFromPoints(forecastPoints) : "";

  let bandPath = "";
  if (forecastPoints.some((point) => point.upper !== undefined && point.lower !== undefined)) {
    const upper = forecastPoints.map((point) => ({
      x: point.x,
      y: point.upper ?? point.y
    }));
    const lower = forecastPoints
      .slice()
      .reverse()
      .map((point) => ({ x: point.x, y: point.lower ?? point.y }));
    bandPath = `${pathFromPoints(upper)} ${lower
      .map((point) => `L${scaleX(point.x)} ${scaleY(point.y)}`)
      .join(" ")} Z`;
  }

  return (
    <svg viewBox="0 0 1000 300" role="img" aria-label="Metal price chart">
      <defs>
        <linearGradient id="forecast" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#57b7a7" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#57b7a7" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((tick) => (
        <line
          key={tick}
          x1="0"
          x2="1000"
          y1={300 * tick}
          y2={300 * tick}
          stroke="rgba(255,255,255,0.05)"
        />
      ))}
      {bandPath ? <path d={bandPath} fill="url(#forecast)" stroke="none" /> : null}
      <path d={actualPath} fill="none" stroke="#d18b3f" strokeWidth="3" />
      {forecastPath ? (
        <path d={forecastPath} fill="none" stroke="#57b7a7" strokeWidth="2" strokeDasharray="8 6" />
      ) : null}
    </svg>
  );
};

export default function Home() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [metalId, setMetalId] = useState(DEFAULT_METAL_ID);
  const [range, setRange] = useState(rangeOptions[2]);
  const [source, setSource] = useState("metalsapi");
  const [base, setBase] = useState("USD");
  const [forecastDays, setForecastDays] = useState(30);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sellerQuery, setSellerQuery] = useState("");
  const [sellerLocation, setSellerLocation] = useState("United States");
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellersLoading, setSellersLoading] = useState(false);
  const [sellersError, setSellersError] = useState<string | null>(null);
  const [includeSellers, setIncludeSellers] = useState(true);

  const metal = METAL_BY_ID.get(metalId) ?? METAL_CATALOG[0];

  const analytics = useMemo(() => (series.length ? computeAnalytics(series) : null), [series]);
  const forecast = useMemo(
    () => (series.length ? forecastLinear(series, forecastDays) : []),
    [series, forecastDays]
  );

  useEffect(() => {
    const loadSession = async () => {
      const response = await fetch("/api/auth/session");
      if (!response.ok) return;
      const data = await response.json();
      setSession(data);
      if (data.defaultLocation) setSellerLocation(data.defaultLocation);
      if (data.defaultCurrency) setBase(data.defaultCurrency);
    };
    loadSession();
  }, []);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/price?symbol=${encodeURIComponent(metal.symbol)}&metalId=${encodeURIComponent(
          metal.id
        )}&range=${range}&source=${source}&base=${encodeURIComponent(base)}`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Price fetch failed.");
      setSeries(data.series || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch prices.");
    } finally {
      setLoading(false);
    }

    if (includeSellers) {
      setSellersLoading(true);
      setSellersError(null);
      try {
        const q = sellerQuery || metal.defaultQuery;
        const response = await fetch(
          `/api/sellers?q=${encodeURIComponent(q)}&location=${encodeURIComponent(
            sellerLocation
          )}&gl=us&hl=en&limit=10`
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Seller fetch failed.");
        setSellers(data.sellers || []);
      } catch (err) {
        setSellersError(err instanceof Error ? err.message : "Failed to fetch sellers.");
      } finally {
        setSellersLoading(false);
      }
    }
  };

  const lastDate = series.length ? series[series.length - 1].date : "—";

  return (
    <main>
      <div className="topbar">
        <div>
          <h1>Unitech Cabels Metal Intelligence</h1>
          <p>
            Real-time pricing, buyer signals, and supplier intelligence for copper and industrial metals.
          </p>
          {session ? (
            <div className="small">
              Workspace: {session.workspaceName || session.workspaceId} | {session.email}
            </div>
          ) : null}
        </div>
        <div className="nav">
          <a href="/">Dashboard</a>
          <a href="/vendors">Vendors</a>
          <a href="/alerts">Alerts</a>
          <button
            className="nav-btn"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
          >
            Log out
          </button>
        </div>
      </div>

      <section className="card">
        <h3>Control Center</h3>
        <div className="controls">
          <div>
            <label>Metal</label>
            <select value={metalId} onChange={(event) => setMetalId(event.target.value)}>
              {METAL_CATALOG.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.display}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Pricing Source</label>
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="metalsapi">Metals-API (LME symbols)</option>
              <option value="fred">FRED (macro series)</option>
            </select>
          </div>
          <div>
            <label>Range (days)</label>
            <select value={range} onChange={(event) => setRange(Number(event.target.value))}>
              {rangeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Base Currency</label>
            <select value={base} onChange={(event) => setBase(event.target.value)}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="INR">INR</option>
            </select>
          </div>
          <div>
            <label>Forecast Horizon (days)</label>
            <input
              type="number"
              min={7}
              max={120}
              value={forecastDays}
              onChange={(event) => setForecastDays(Number(event.target.value))}
            />
          </div>
          <div>
            <label>Include Seller Intelligence</label>
            <select value={includeSellers ? "yes" : "no"} onChange={(event) => setIncludeSellers(event.target.value === "yes")}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label>Seller Search Query</label>
            <input
              value={sellerQuery}
              onChange={(event) => setSellerQuery(event.target.value)}
              placeholder={metal.defaultQuery}
            />
          </div>
          <div>
            <label>Seller Location</label>
            <input
              value={sellerLocation}
              onChange={(event) => setSellerLocation(event.target.value)}
            />
          </div>
          <div>
            <label>&nbsp;</label>
            <button onClick={runAnalysis} disabled={loading}>
              {loading ? "Running..." : "Run Intelligence"}
            </button>
          </div>
        </div>
        <div className="small" style={{ marginTop: "12px" }}>
          Data timestamp: {lastDate} | Unit: {metal.unit} | Source: {source}
        </div>
        {error ? <div className="small" style={{ color: "#e46f6f" }}>{error}</div> : null}
      </section>

      <section className="grid">
        <div className="card">
          <h3>Signal</h3>
          {analytics ? (
            <>
              <div className={statusBadgeClass(analytics.signal.label)}>{analytics.signal.label}</div>
              <p className="small" style={{ marginTop: "10px" }}>{analytics.signal.reason}</p>
            </>
          ) : (
            <p className="small">Run analysis to calculate the buy signal.</p>
          )}
        </div>
        <div className="card">
          <h3>Latest Snapshot</h3>
          {analytics ? (
            <div className="table">
              <div className="table-row">
                <span>Latest Price</span>
                <strong>{formatNumber(analytics.latest)}</strong>
              </div>
              <div className="table-row">
                <span>7D Change</span>
                <strong>{formatPercent(analytics.change7)}</strong>
              </div>
              <div className="table-row">
                <span>30D Change</span>
                <strong>{formatPercent(analytics.change30)}</strong>
              </div>
              <div className="table-row">
                <span>90D Change</span>
                <strong>{formatPercent(analytics.change90)}</strong>
              </div>
              <div className="table-row">
                <span>Volatility (Ann.)</span>
                <strong>{formatPercent(analytics.volatility)}</strong>
              </div>
            </div>
          ) : (
            <p className="small">No analytics yet.</p>
          )}
        </div>
        <div className="card">
          <h3>Momentum</h3>
          {analytics ? (
            <div className="table">
              <div className="table-row">
                <span>RSI (14)</span>
                <strong>{formatNumber(analytics.rsi14, 1)}</strong>
              </div>
              <div className="table-row">
                <span>Trend Slope</span>
                <strong>{formatNumber(analytics.trendSlope, 4)}</strong>
              </div>
              <div className="table-row">
                <span>Drawdown</span>
                <strong>{formatPercent(analytics.drawdown)}</strong>
              </div>
              <div className="table-row">
                <span>Support (20%)</span>
                <strong>{formatNumber(analytics.support)}</strong>
              </div>
              <div className="table-row">
                <span>Resistance (80%)</span>
                <strong>{formatNumber(analytics.resistance)}</strong>
              </div>
            </div>
          ) : (
            <p className="small">No analytics yet.</p>
          )}
        </div>
      </section>

      <section className="card">
        <h3>Price Trajectory & Forecast</h3>
        <div className="chart-wrap">
          <LineChart series={series} forecast={forecast} />
        </div>
        <div className="small" style={{ marginTop: "12px" }}>
          Forecast uses a linear regression fit on the last 90 days. Use it as directional guidance, not
          certainty.
        </div>
      </section>

      <section className="card">
        <h3>Buyer Checklist</h3>
        <div className="table">
          <div className="table-row">
            <span>Price vs 30D Average</span>
            <strong>{analytics?.ma30 ? formatNumber((analytics.latest / analytics.ma30 - 1) * 100, 2) + "%" : "—"}</strong>
          </div>
          <div className="table-row">
            <span>7D Moving Avg</span>
            <strong>{formatNumber(analytics?.ma7)}</strong>
          </div>
          <div className="table-row">
            <span>30D Moving Avg</span>
            <strong>{formatNumber(analytics?.ma30)}</strong>
          </div>
          <div className="table-row">
            <span>90D Moving Avg</span>
            <strong>{formatNumber(analytics?.ma90)}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <h3>Low Price Seller Scan</h3>
        {includeSellers ? (
          <>
            {sellersLoading ? <p className="small">Fetching sellers...</p> : null}
            {sellersError ? <p className="small" style={{ color: "#e46f6f" }}>{sellersError}</p> : null}
            {!sellersLoading && !sellers.length ? (
              <p className="small">No sellers loaded yet. Run intelligence to pull listings.</p>
            ) : null}
            <div className="list">
              {sellers.map((seller, idx) => (
                <div key={`${seller.title}-${idx}`} className="card" style={{ padding: "12px" }}>
                  <strong>{seller.title || "Listing"}</strong>
                  <div className="small">Price: {seller.price || "—"}</div>
                  <div className="small">Source: {seller.source || "—"}</div>
                  <div className="small">Delivery: {seller.delivery || "—"}</div>
                  {seller.link ? (
                    <a href={seller.link} target="_blank" rel="noreferrer">
                      View listing
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="small">Seller intelligence is disabled in Control Center.</p>
        )}
      </section>

      <footer>
        This dashboard provides analytic signals for procurement planning. It is not financial advice.
      </footer>
    </main>
  );
}
