"use client";

import { useEffect, useMemo, useState } from "react";
import { METAL_CATALOG, METAL_BY_ID, DEFAULT_METAL_ID } from "@/lib/metal";

type Quote = {
  id: string;
  vendor: string;
  metalId: string;
  grade?: string;
  unit: "kg" | "ton";
  price: number;
  currency: string;
  freightPerKg?: number;
  dutyPercent?: number;
  taxPercent?: number;
  otherPerKg?: number;
  leadTimeDays?: number;
  paymentTerms?: string;
  notes?: string;
  createdAt: string;
};

const toNumber = (value: string) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const landedCostPerKg = (quote: Quote) => {
  const basePerKg = quote.unit === "ton" ? quote.price / 1000 : quote.price;
  const duty = basePerKg * ((quote.dutyPercent || 0) / 100);
  const tax = basePerKg * ((quote.taxPercent || 0) / 100);
  const freight = quote.freightPerKg || 0;
  const other = quote.otherPerKg || 0;
  return basePerKg + duty + tax + freight + other;
};

export default function VendorsPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vendor, setVendor] = useState("");
  const [metalId, setMetalId] = useState(DEFAULT_METAL_ID);
  const [grade, setGrade] = useState("");
  const [unit, setUnit] = useState<"kg" | "ton">("kg");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [freightPerKg, setFreightPerKg] = useState("");
  const [dutyPercent, setDutyPercent] = useState("");
  const [taxPercent, setTaxPercent] = useState("");
  const [otherPerKg, setOtherPerKg] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");

  const loadQuotes = async () => {
    const response = await fetch("/api/quotes");
    if (!response.ok) return;
    const data = await response.json();
    setQuotes(data.quotes || []);
  };

  useEffect(() => {
    loadQuotes();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor,
          metalId,
          grade,
          unit,
          price: toNumber(price),
          currency,
          freightPerKg: toNumber(freightPerKg),
          dutyPercent: toNumber(dutyPercent),
          taxPercent: toNumber(taxPercent),
          otherPerKg: toNumber(otherPerKg),
          leadTimeDays: toNumber(leadTimeDays),
          paymentTerms,
          notes
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to add quote.");
      setQuotes(data.quotes || []);
      setVendor("");
      setGrade("");
      setPrice("");
      setFreightPerKg("");
      setDutyPercent("");
      setTaxPercent("");
      setOtherPerKg("");
      setLeadTimeDays("");
      setPaymentTerms("");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add quote.");
    } finally {
      setLoading(false);
    }
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1).map((line) => line.split(",").map((cell) => cell.trim()));
    const items = rows.map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((header, idx) => {
        record[header] = row[idx] ?? "";
      });
      return {
        vendor: record.vendor,
        metalId: record.metalId,
        grade: record.grade,
        unit: record.unit === "ton" ? "ton" : "kg",
        price: toNumber(record.price),
        currency: record.currency || "USD",
        freightPerKg: toNumber(record.freightPerKg),
        dutyPercent: toNumber(record.dutyPercent),
        taxPercent: toNumber(record.taxPercent),
        otherPerKg: toNumber(record.otherPerKg),
        leadTimeDays: toNumber(record.leadTimeDays),
        paymentTerms: record.paymentTerms,
        notes: record.notes
      };
    });

    const response = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });
    const data = await response.json();
    if (response.ok) setQuotes(data.quotes || []);
  };

  const sortedQuotes = useMemo(() => {
    return [...quotes].sort((a, b) => landedCostPerKg(a) - landedCostPerKg(b));
  }, [quotes]);

  return (
    <main>
      <div className="topbar">
        <div>
          <h1>Vendor Intelligence</h1>
          <p>Upload and compare supplier quotes to calculate landed cost per kg.</p>
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
        <h3>Add Vendor Quote</h3>
        <form className="controls" onSubmit={submit}>
          <div>
            <label>Vendor Name</label>
            <input value={vendor} onChange={(event) => setVendor(event.target.value)} required />
          </div>
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
            <label>Grade / Spec</label>
            <input value={grade} onChange={(event) => setGrade(event.target.value)} />
          </div>
          <div>
            <label>Unit</label>
            <select value={unit} onChange={(event) => setUnit(event.target.value as "kg" | "ton")}>
              <option value="kg">Per Kg</option>
              <option value="ton">Per Ton</option>
            </select>
          </div>
          <div>
            <label>Quoted Price</label>
            <input value={price} onChange={(event) => setPrice(event.target.value)} required />
          </div>
          <div>
            <label>Currency</label>
            <input value={currency} onChange={(event) => setCurrency(event.target.value)} />
          </div>
          <div>
            <label>Freight Per Kg</label>
            <input value={freightPerKg} onChange={(event) => setFreightPerKg(event.target.value)} />
          </div>
          <div>
            <label>Duty %</label>
            <input value={dutyPercent} onChange={(event) => setDutyPercent(event.target.value)} />
          </div>
          <div>
            <label>Tax %</label>
            <input value={taxPercent} onChange={(event) => setTaxPercent(event.target.value)} />
          </div>
          <div>
            <label>Other Costs Per Kg</label>
            <input value={otherPerKg} onChange={(event) => setOtherPerKg(event.target.value)} />
          </div>
          <div>
            <label>Lead Time (days)</label>
            <input value={leadTimeDays} onChange={(event) => setLeadTimeDays(event.target.value)} />
          </div>
          <div>
            <label>Payment Terms</label>
            <input value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} />
          </div>
          <div>
            <label>Notes</label>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          <div>
            <label>&nbsp;</label>
            <button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Quote"}
            </button>
          </div>
        </form>
        {error ? <p className="small" style={{ color: "#e46f6f" }}>{error}</p> : null}
      </section>

      <section className="card">
        <h3>Bulk Upload (CSV)</h3>
        <p className="small">
          Columns: vendor,metalId,grade,unit,price,currency,freightPerKg,dutyPercent,taxPercent,otherPerKg,leadTimeDays,paymentTerms,notes
        </p>
        <input
          type="file"
          accept=".csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) importCsv(file);
          }}
        />
      </section>

      <section className="card">
        <h3>Quote Comparison</h3>
        {!sortedQuotes.length ? (
          <p className="small">No quotes yet.</p>
        ) : (
          <div className="list">
            {sortedQuotes.map((quote) => {
              const metal = METAL_BY_ID.get(quote.metalId);
              const landed = landedCostPerKg(quote);
              return (
                <div key={quote.id} className="card" style={{ padding: "12px" }}>
                  <strong>{quote.vendor}</strong>
                  <div className="small">Metal: {metal?.display || quote.metalId}</div>
                  <div className="small">Grade: {quote.grade || "—"}</div>
                  <div className="small">Quoted: {quote.price} {quote.currency} per {quote.unit}</div>
                  <div className="small">Landed Cost: {landed.toFixed(2)} {quote.currency} per kg</div>
                  <div className="small">Lead Time: {quote.leadTimeDays ?? "—"} days</div>
                  <button
                    className="nav-btn"
                    onClick={async () => {
                      await fetch(`/api/quotes?id=${quote.id}`, { method: "DELETE" });
                      loadQuotes();
                    }}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
