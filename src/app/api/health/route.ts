import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Minimal DB health check: verifies envs and that we can read 1 row.
export async function GET() {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return NextResponse.json(
        { ok: false, db: "env-missing", missing: { SUPABASE_URL: !url, SUPABASE_SERVICE_ROLE_KEY: !key } },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false },
    });

    // Read a single row to prove RLS/connection are OK.
    const { data, error } = await supabase
      .from("market_baselines")
      .select("id, year, adr_median")
      .limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, db: "error", error: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { ok: false, db: "connected", note: "noRowsInTable" },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ok: true,
      db: "connected",
      sample: data[0],
      time: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, db: "exception", error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
