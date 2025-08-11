import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const TURO_CUTS: Record<string, number> = {
  standard: 0.25,
  premium: 0.40,
  "90": 0.10,
  "80": 0.20,
  "75": 0.25,
  "70": 0.30,
  "60": 0.40,
};

function pctFromPlan(plan?: string) {
  if (!plan) return 0.25;
  const key = plan.toLowerCase();
  return TURO_CUTS[key] ?? 0.25;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const zip = url.searchParams.get("zip") ?? undefined;
  const make = url.searchParams.get("make") ?? undefined;
  const model = url.searchParams.get("model") ?? undefined;
  const yearParam = url.searchParams.get("year") ?? undefined;
  const turoPlan = url.searchParams.get("turoPlan") ?? "standard";

  const year = yearParam ? Number(yearParam) : undefined;
  if (!year) {
    return NextResponse.json({ ok: false, error: "Missing year" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("market_baselines")
    .select("*")
    .eq("year", year)
    .limit(1);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ ok: false, error: "baselineNotFound" }, { status: 404 });
  }

  const row = data[0] as any;

  const adr = Number(row.adr_median ?? 0);
  const daysListed = Number(row.avg_days_listed ?? 18);
  const occupancy = Math.max(0, Math.min(1, daysListed / 30));
  const gross = adr * occupancy * 30;
  const turoCut = pctFromPlan(turoPlan);
  const net = gross * (1 - turoCut);

  return NextResponse.json({
    ok: true,
    inputs: { zip, make, model, year, turoPlan },
    baseline: {
      adr,
      occupancy,
      trips_median: row.trips_median ?? null,
      rating_avg: row.rating_avg ?? null,
      sample_size: row.sample_size ?? null,
    },
    results: {
      monthly_gross: Number(gross.toFixed(2)),
      turo_cut_pct: turoCut,
      monthly_net: Number(net.toFixed(2)),
    },
  });
}
