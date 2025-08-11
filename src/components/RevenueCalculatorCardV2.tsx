"use client";

import { useState } from "react";

// Response shape from /api/estimate (the one you just built)
type EstimateAPI = {
  ok: boolean;
  inputs?: {
    zip?: string;
    make?: string;
    model?: string;
    year?: number;
    turoPlan?: string;
  };
  baseline?: {
    adr?: number;               // e.g. 88
    occupancy?: number;         // 0..1
    trips_median?: number | null;
    rating_avg?: number | null;
    sample_size?: number | null;
  };
  results?: {
    monthly_gross: number;      // e.g. 2288
    turo_cut_pct: number;       // e.g. 0.25
    monthly_net: number;        // e.g. 1716
  };
  error?: string;
};

const PLAN_OPTIONS = [
  { value: "standard", label: "Standard (25%)", pct: 25 },
  { value: "premium",  label: "Premium (40%)",  pct: 40 },
  { value: "90",       label: "90 Plan (10%)",  pct: 10 },
  { value: "80",       label: "80 Plan (20%)",  pct: 20 },
  { value: "75",       label: "75 Plan (25%)",  pct: 25 },
  { value: "70",       label: "70 Plan (30%)",  pct: 30 },
  { value: "60",       label: "60 Plan (40%)",  pct: 40 },
];

export default function RevenueCalculatorCardV2() {
  // UI mode: VIN coming soon; we'll default to Make/Model for now
  const [mode, setMode] = useState<"vin" | "mm">("mm");

  // Inputs
  const [vin, setVin] = useState("");
  const [zip, setZip] = useState("75063");
  const [year, setYear] = useState<number | "">(2021);
  const [make, setMake] = useState("Toyota");
  const [model, setModel] = useState("Camry");
  const [trim, setTrim] = useState("");

  const [turoPlan, setTuroPlan] = useState<string>("standard");
  const [days, setDays] = useState(30);

  // Editable assumptions (start empty; we’ll populate from API)
  const [adr, setAdr] = useState<number | "">("");
  const [occPct, setOccPct] = useState<number | "">(""); // percent 0..100
  const [feePct, setFeePct] = useState<number | "">(""); // percent 0..100

  // Server response + UI state
  const [res, setRes] = useState<EstimateAPI | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helpful label
  const vehicleLabel =
    (year ? `${year} ` : "") +
    (make ? `${make} ` : "") +
    (model ? `${model}` : "");

  // Derived numbers shown in the KPI card
  const effectiveADR = (adr === "" ? res?.baseline?.adr ?? 0 : Number(adr));
  const effectiveOcc = (occPct === "" ? (res?.baseline?.occupancy ?? 0) * 100 : Number(occPct)); // %
  const effectiveFee = (feePct === "" ? (res?.results?.turo_cut_pct ?? 0) * 100 : Number(feePct)); // %
  const effectiveDays = days || 30;

  const monthlyGross = Number((effectiveADR * (effectiveOcc / 100) * effectiveDays).toFixed(2));
  const monthlyNet   = Number((monthlyGross * (1 - effectiveFee / 100)).toFixed(2));

  const canSubmit =
    mode === "mm"
      ? Boolean(year && make && model && zip.length >= 5)
      : vin.length === 17 && zip.length >= 5;

  async function onEstimate() {
    setLoading(true); setError(null);
    try {
      if (mode === "vin") {
        // VIN path not implemented yet — show friendly message
        setLoading(false);
        setError("VIN mode coming soon. Use Make/Model for now.");
        return;
      }

      // Call your working endpoint
      const params = new URLSearchParams({
        zip,
        make,
        model,
        year: String(year),
        turoPlan,
      });
      const r = await fetch(`/api/estimate?${params.toString()}`, { cache: "no-store" });
      const data: EstimateAPI = await r.json();

      if (!data.ok) throw new Error(data.error ?? "Failed to estimate");

      setRes(data);

      // Seed the editable inputs from API results so user can tweak
      const apiADR = data.baseline?.adr ?? null;
      const apiOccPct = (data.baseline?.occupancy ?? 0) * 100;
      const apiFeePct = (data.results?.turo_cut_pct ?? 0) * 100;

      setAdr(apiADR ?? "");
      setOccPct(Number.isFinite(apiOccPct) ? Math.round(apiOccPct) : "");
      setFeePct(Number.isFinite(apiFeePct) ? Math.round(apiFeePct) : "");

      // Keep days at 30 unless you want to return it from API later
      setDays(30);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function onSave() {
    if (!res) return;
    // Example POST; wire to your real save endpoint when ready
    const body = {
      vehicle: { year, make, model, trim, vin: mode === "vin" ? vin : undefined },
      assumptions: {
        adr: effectiveADR,
        occ: effectiveOcc / 100,
        daysPerMonth: effectiveDays,
        turoFeePct: effectiveFee / 100,
      },
      results: { monthlyGross, monthlyNet },
      zip,
      turoPlan,
    };
    await fetch("/api/create-estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl border border-gray-200 bg-white shadow-md p-6 space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-900">Revenue Calculator</h2>
        <p className="text-slate-500">Estimate your potential monthly earnings</p>

        <div className="inline-flex rounded-full bg-slate-100 p-1">
          {(["vin", "mm"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-sm rounded-full ${
                mode === m ? "bg-white shadow border border-slate-200" : "text-slate-600"
              }`}
            >
              {m === "vin" ? "By VIN" : "By Make/Model"}
            </button>
          ))}
        </div>
        {mode === "vin" && (
          <div className="text-xs text-amber-600 mt-1">
            VIN mode coming soon — use Make/Model for now.
          </div>
        )}
      </div>

      {/* Inputs */}
      {mode === "vin" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            placeholder="VIN (17 chars)"
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none"
          />
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="ZIP"
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none"
          />
          <button
            disabled={!canSubmit || loading}
            onClick={onEstimate}
            className="rounded-xl bg-[#007AFF] text-white px-4 py-2 disabled:opacity-50"
          >
            {loading ? "Estimating..." : "Estimate"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value) || "")}
            placeholder="Year"
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none"
          />
          <input
            value={make}
            onChange={(e) => setMake(e.target.value)}
            placeholder="Make"
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none"
          />
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Model"
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none"
          />
          <input
            value={trim}
            onChange={(e) => setTrim(e.target.value)}
            placeholder="Trim (optional)"
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none"
          />
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="ZIP"
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none"
          />
          <select
            value={turoPlan}
            onChange={(e) => setTuroPlan(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none"
          >
            {PLAN_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <div className="md:col-span-6">
            <button
              disabled={!canSubmit || loading}
              onClick={onEstimate}
              className="w-full md:w-auto rounded-xl bg-[#007AFF] text-white px-4 py-2 disabled:opacity-50"
            >
              {loading ? "Estimating..." : "Estimate"}
            </button>
          </div>
        </div>
      )}

      {/* Vehicle line */}
      {vehicleLabel && <div className="text-sm text-slate-600">{vehicleLabel}</div>}

      {/* KPI */}
      <div
        className="rounded-2xl border border-slate-200 p-6"
        style={{ background: "linear-gradient(180deg, rgba(0,122,255,0.03) 0%, rgba(255,255,255,1) 60%)" }}
      >
        <div className="text-sm text-slate-500">Estimated Monthly Net</div>
        <div className="text-5xl font-bold tracking-tight text-slate-900">${monthlyNet.toLocaleString()}</div>
        <div className="mt-1 text-slate-500">Estimated Gross: ${monthlyGross.toLocaleString()}</div>
      </div>

      {/* Assumptions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">ADR</span>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <span className="text-slate-400">$</span>
            <input
              value={adr}
              onChange={(e) => setAdr(e.target.value === "" ? "" : Number(e.target.value))}
              inputMode="decimal"
              className="w-full outline-none"
              placeholder="e.g., 88"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">Occupancy</span>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <input
              value={occPct}
              onChange={(e) => setOccPct(e.target.value === "" ? "" : Number(e.target.value))}
              inputMode="numeric"
              className="w-full outline-none"
              placeholder="e.g., 72"
            />
            <span className="text-slate-400">%</span>
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">Turo fee</span>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <input
                value={feePct}
                onChange={(e) => setFeePct(e.target.value === "" ? "" : Number(e.target.value))}
                inputMode="numeric"
                className="w-full outline-none"
                placeholder="25"
              />
              <span className="text-slate-400">%</span>
            </div>
            <div className="hidden md:flex rounded-xl border border-slate-200">
              {[15, 20, 25, 30, 40].map((p) => (
                <button key={p} onClick={() => setFeePct(p)} className="px-3 py-2 text-sm hover:bg-slate-50">
                  {p}%
                </button>
              ))}
            </div>
          </div>
        </label>
      </div>

      {/* Advanced */}
      {res && (
        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm text-slate-600">Advanced</summary>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-600">
            {typeof res.baseline?.sample_size === "number" && (
              <div>Sample size: <span className="font-medium">{res.baseline.sample_size}</span></div>
            )}
            {typeof res.baseline?.trips_median === "number" && (
              <div>Trips median: <span className="font-medium">{res.baseline.trips_median}</span></div>
            )}
            {typeof res.baseline?.rating_avg === "number" && (
              <div>Avg rating: <span className="font-medium">{res.baseline.rating_avg}</span></div>
            )}
            <label className="flex items-center gap-2">
              Days per month
              <input
                value={effectiveDays}
                onChange={(e) => setDays(Number(e.target.value || 30))}
                className="ml-2 w-16 rounded-lg border border-slate-200 px-2 py-1"
              />
            </label>
          </div>
        </details>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button onClick={onEstimate} className="text-slate-700 hover:text-slate-900" disabled={!canSubmit || loading}>
          Recalculate
        </button>
        <button onClick={onSave} disabled={!res} className="inline-flex items-center gap-2 rounded-xl bg-[#007AFF] px-4 py-2 text-white disabled:opacity-50">
          Save Estimate
        </button>
      </div>

      <p className="text-xs text-slate-400">*Estimates vary by seasonality and competition.</p>
      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}
