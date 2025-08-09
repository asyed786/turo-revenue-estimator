"use client";

import { useState } from "react";

type EstimateResp = {
  success: boolean;
  vehicle: { year: number; make: string; model: string; trim?: string; segment?: string; vin?: string };
  assumptions: { baselineADR: number; occupancy: number; daysPerMonth: number; turoFee: number };
  estimate: { monthlyGross: number; monthlyNet: number; roi?: number; confidence?: number; comps?: number };
};

export default function RevenueCalculatorCardV2() {
  const [mode, setMode] = useState<"vin" | "mm">("vin");
  const [vin, setVin] = useState("");
  const [zip, setZip] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  const [days, setDays] = useState(30);

  const [adr, setAdr] = useState<number | null>(null);
  const [occ, setOcc] = useState<number | null>(null);
  const [fee, setFee] = useState<number | null>(null);

  const [res, setRes] = useState<EstimateResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vehicleLabel =
    res?.vehicle
      ? `${res.vehicle.year} ${res.vehicle.make} ${res.vehicle.model}${res.vehicle.trim ? " " + res.vehicle.trim : ""} • ${res.vehicle.segment ?? ""}`.trim()
      : "";

  const gross = (() => {
    const a = adr ?? res?.assumptions.baselineADR;
    const o = (occ ?? res?.assumptions.occupancy) ?? 0;
    if (a == null || o == null) return res?.estimate.monthlyGross ?? 0;
    return Number((a * (o / 100) * days).toFixed(2));
  })();

  const net = (() => {
    const f = (fee ?? res?.assumptions.turoFee) ?? 0;
    return Number((gross * (1 - f / 100)).toFixed(2));
  })();

  const canSubmit = mode === "vin"
    ? vin.length === 17 && zip.length >= 5
    : year && make && model && zip.length >= 5;

  async function onEstimate() {
    setLoading(true); setError(null);
    try {
      const url = mode === "vin"
        ? `/api/estimate-by-vin?vin=${encodeURIComponent(vin)}&zip=${encodeURIComponent(zip)}`
        : `/api/estimate-by-make-model?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&trim=${encodeURIComponent(trim)}&zip=${encodeURIComponent(zip)}`;
      const r = await fetch(url);
      const data: EstimateResp = await r.json();
      if (!data?.success) throw new Error("Failed to estimate");
      setRes(data);
      setAdr(data.assumptions.baselineADR);
      setOcc(data.assumptions.occupancy * 100);
      setFee(data.assumptions.turoFee * 100);
      setDays(data.assumptions.daysPerMonth ?? 30);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally { setLoading(false); }
  }

  async function onSave() {
    if (!res) return;
    const body = {
      vehicle: res.vehicle,
      assumptions: { adr: adr ?? res.assumptions.baselineADR, occ: occ ?? res.assumptions.occupancy, daysPerMonth: days, turoFee: fee ?? res.assumptions.turoFee },
      estimate: { monthlyGross: gross, monthlyNet: net, roi: res.estimate.roi ?? 0, confidence: res.estimate.confidence ?? 0, comps: res.estimate.comps ?? 0 },
      zip
    };
    await fetch("/api/create-estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl border border-gray-200 bg-white shadow-md p-6 space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-900">Revenue Calculator</h2>
        <p className="text-slate-500">Estimate your potential monthly earnings</p>
        <div className="inline-flex rounded-full bg-slate-100 p-1">
          {(["vin", "mm"] as const).map(m => (
            <button key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-sm rounded-full ${mode === m ? "bg-white shadow border border-slate-200" : "text-slate-600"}`}>
              {m === "vin" ? "By VIN" : "By Make/Model"}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs */}
      {mode === "vin" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input value={vin} onChange={e => setVin(e.target.value.toUpperCase())} placeholder="VIN (17 chars)" className="rounded-xl border border-slate-200 px-3 py-2 outline-none" />
          <input value={zip} onChange={e => setZip(e.target.value)} placeholder="ZIP" className="rounded-xl border border-slate-200 px-3 py-2 outline-none" />
          <button disabled={!canSubmit || loading} onClick={onEstimate}
            className="rounded-xl bg-[#007AFF] text-white px-4 py-2 disabled:opacity-50">{loading ? "Estimating..." : "Estimate"}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input value={year} onChange={e => setYear(e.target.value)} placeholder="Year" className="rounded-xl border border-slate-200 px-3 py-2 outline-none" />
          <input value={make} onChange={e => setMake(e.target.value)} placeholder="Make" className="rounded-xl border border-slate-200 px-3 py-2 outline-none" />
          <input value={model} onChange={e => setModel(e.target.value)} placeholder="Model" className="rounded-xl border border-slate-200 px-3 py-2 outline-none" />
          <input value={trim} onChange={e => setTrim(e.target.value)} placeholder="Trim (optional)" className="rounded-xl border border-slate-200 px-3 py-2 outline-none" />
          <div className="flex gap-3">
            <input value={zip} onChange={e => setZip(e.target.value)} placeholder="ZIP" className="flex-1 rounded-xl border border-slate-200 px-3 py-2 outline-none" />
            <button disabled={!canSubmit || loading} onClick={onEstimate}
              className="rounded-xl bg-[#007AFF] text-white px-4 py-2 disabled:opacity-50">{loading ? "Estimating..." : "Estimate"}</button>
          </div>
        </div>
      )}

      {/* Vehicle line */}
      {vehicleLabel && <div className="text-sm text-slate-600">{vehicleLabel}</div>}

      {/* KPI */}
      <div className="rounded-2xl border border-slate-200 p-6" style={{ background: "linear-gradient(180deg, rgba(0,122,255,0.03) 0%, rgba(255,255,255,1) 60%)" }}>
        <div className="text-sm text-slate-500">Estimated Monthly Net</div>
        <div className="text-5xl font-bold tracking-tight text-slate-900">${net.toLocaleString()}</div>
        <div className="mt-1 text-slate-500">Estimated Gross: ${gross.toLocaleString()}</div>
      </div>

      {/* Assumptions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">ADR</span>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <span className="text-slate-400">$</span>
            <input value={adr ?? ""} onChange={e => setAdr(Number(e.target.value || 0))} inputMode="decimal" className="w-full outline-none" placeholder="e.g., 88" />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">Occupancy</span>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <input value={occ ?? ""} onChange={e => setOcc(Number(e.target.value || 0))} inputMode="numeric" className="w-full outline-none" placeholder="e.g., 72" />
            <span className="text-slate-400">%</span>
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">Turo fee</span>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <input value={fee ?? ""} onChange={e => setFee(Number(e.target.value || 0))} inputMode="numeric" className="w-full outline-none" placeholder="25" />
              <span className="text-slate-400">%</span>
            </div>
            <div className="hidden md:flex rounded-xl border border-slate-200">
              {["15", "20", "25"].map(p => (
                <button key={p} onClick={() => setFee(Number(p))} className="px-3 py-2 text-sm hover:bg-slate-50">{p}%</button>
              ))}
            </div>
          </div>
        </label>
      </div>

      {/* Advanced */}
      {res && (
        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm text-slate-600">Advanced assumptions</summary>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-600">
            <div>Confidence: <span className="font-medium">{Math.round((res.estimate.confidence ?? 0) * 100)}%</span></div>
            <div>Comps: <span className="font-medium">{res.estimate.comps ?? 0}</span></div>
            <label className="flex items-center gap-2">Days per month
              <input value={days} onChange={e => setDays(Number(e.target.value || 30))} className="ml-2 w-16 rounded-lg border border-slate-200 px-2 py-1" />
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
