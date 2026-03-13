"use client";

import { useEffect, useState } from "react";
import { METAL_CATALOG, METAL_BY_ID, DEFAULT_METAL_ID } from "@/lib/metal";

type AlertRule = {
  id: string;
  metalId: string;
  direction: "below" | "above";
  target: number;
  base: string;
  channel: "email" | "whatsapp";
  recipient: string;
  active: boolean;
  cooldownHours?: number;
  lastTriggeredAt?: string;
  createdAt: string;
};

const toNumber = (value: string) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [metalId, setMetalId] = useState(DEFAULT_METAL_ID);
  const [direction, setDirection] = useState<"below" | "above">("below");
  const [target, setTarget] = useState("");
  const [base, setBase] = useState("USD");
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [recipient, setRecipient] = useState("");
  const [cooldownHours, setCooldownHours] = useState("24");

  const loadAlerts = async () => {
    const response = await fetch("/api/alerts");
    if (!response.ok) return;
    const data = await response.json();
    setAlerts(data.alerts || []);
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metalId,
          direction,
          target: toNumber(target),
          base,
          channel,
          recipient,
          cooldownHours: toNumber(cooldownHours)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to add alert.");
      setAlerts(data.alerts || []);
      setTarget("");
      setRecipient("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add alert.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <div className="topbar">
        <div>
          <h1>Alert Center</h1>
          <p>Trigger email or WhatsApp alerts when metal prices cross your thresholds.</p>
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
        <h3>Create Alert</h3>
        <form className="controls" onSubmit={submit}>
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
            <label>Direction</label>
            <select value={direction} onChange={(event) => setDirection(event.target.value as "below" | "above")}>
              <option value="below">Below Target</option>
              <option value="above">Above Target</option>
            </select>
          </div>
          <div>
            <label>Target Price</label>
            <input value={target} onChange={(event) => setTarget(event.target.value)} required />
          </div>
          <div>
            <label>Currency</label>
            <input value={base} onChange={(event) => setBase(event.target.value)} />
          </div>
          <div>
            <label>Channel</label>
            <select value={channel} onChange={(event) => setChannel(event.target.value as "email" | "whatsapp")}>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <div>
            <label>Recipient</label>
            <input
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder={channel === "email" ? "buyer@unitech.com" : "+1XXXXXXXXXX"}
              required
            />
          </div>
          <div>
            <label>Cooldown (hours)</label>
            <input value={cooldownHours} onChange={(event) => setCooldownHours(event.target.value)} />
          </div>
          <div>
            <label>&nbsp;</label>
            <button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Alert"}
            </button>
          </div>
        </form>
        {error ? <p className="small" style={{ color: "#e46f6f" }}>{error}</p> : null}
      </section>

      <section className="card">
        <h3>Active Alerts</h3>
        {!alerts.length ? (
          <p className="small">No alerts yet.</p>
        ) : (
          <div className="list">
            {alerts.map((alert) => {
              const metal = METAL_BY_ID.get(alert.metalId);
              return (
                <div key={alert.id} className="card" style={{ padding: "12px" }}>
                  <strong>{metal?.display || alert.metalId}</strong>
                  <div className="small">
                    Trigger when {alert.direction} {alert.target} {alert.base}
                  </div>
                  <div className="small">Channel: {alert.channel} | Recipient: {alert.recipient}</div>
                  <div className="small">Last Triggered: {alert.lastTriggeredAt || "—"}</div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                    <button
                      className="nav-btn"
                      onClick={async () => {
                        await fetch("/api/alerts", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: alert.id, active: !alert.active })
                        });
                        loadAlerts();
                      }}
                    >
                      {alert.active ? "Pause" : "Activate"}
                    </button>
                    <button
                      className="nav-btn"
                      onClick={async () => {
                        await fetch(`/api/alerts?id=${alert.id}`, { method: "DELETE" });
                        loadAlerts();
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
