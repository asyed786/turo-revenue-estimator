// src/app/api/estimate-by-vin/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Very light VIN validation: 17 chars, excludes I/O/Q per spec.
 */
function looksLikeVin(vin: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
}

/**
 * Decode VIN via NHTSA (public API).
 * Docs: https://vpic.nhtsa.dot.gov/api/
 */
async function decodeVin(vin: string) {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvaluesextended/${vin}?format=json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`NHTSA VIN lookup failed (${res.status})`);
  const data = await res.json();

  const row = data?.Results?.[0] ?? {};
  return {
    make: row.Make || null,
    model: row.Model || null,
    trim: row.Trim || null,
    year: row.ModelYear ? Number(row.ModelYear) : null,
    bodyClass: row.BodyClass || null,
    // You can pluck more fields as needed from 'row'
    raw: row,
  };
}

/**
 * Very dumb heuristic to turn a decoded vehicle into a “segment”.
 * Swap this for your real logic (or Chrome-extension comps).
 */
function guessSegment(bodyClass?: string | null, trim?: string | null) {
  const txt = `${bodyClass || ""} ${trim || ""}`.toLowerCase();
  if (txt.includes("suv")) return "SUV";
  if (txt.includes("pickup") || txt.includes("truck")) return "Truck";
  if (txt.includes("convertible")) return "Convertible";
  if (txt.includes("van")) return "Van";
  if (txt.includes("wagon")) return "Wagon";
  if (txt.includes("coupe")) return "Coupe";
  if (txt.includes("hatchback")) return "Hatchback";
  return "Sedan";
}

/**
 * Toy mapping from segment -> baseline ADR (daily rate).
 * Replace with real comps (Turo scrape, your DB, etc.)
 */
const BASELINE_ADR: Record<string, number> = {
  Economy: 55,
  Sedan: 70,
  Hatchback: 60,
  Coupe: 75,
  Convertible: 120,
  SUV: 95,
  Truck: 110,
  Van: 85,
  Wagon: 80,
};

function segmentToADR(segment: string) {
  return BASELINE_ADR[segment] ?? 75;
}

/**
 * Stub occupancy by ZIP (totally a placeholder).
 * Replace with: historical utilisation from your store, city/seasonality model, etc.
 */
function occupancyForZip(zip?: string | null) {
  if (!zip) return 0.65;
  // silly “bigger city-ish” guess
  if (/^9\d{4}$/.test(zip)) return 0.7;  // many CA zips
  if (/^1\d{4}$/.test(zip)) return 0.68; // many NY/MA etc
  return 0.64;
}

/**
 * Compute monthly revenue-ish:
 * monthlyGross = ADR * occupancy * 30
 * monthlyNet   = monthlyGross * (1 - fee)
 */
function computeEstimate(adr: number, occ: number) {
  const monthlyGross = adr * occ * 30;
  const turoFee = 0.25; // placeholder; depends on protection plan etc.
  const monthlyNet = monthlyGross * (1 - turoFee);
  return { monthlyGross, monthlyNet };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const vin = (body?.vin || "").toString().trim().toUpperCase();
    const zip = body?.zip?.toString()?.trim() || null;

    if (!vin || !looksLikeVin(vin)) {
      return NextResponse.json(
        { success: false, error: "Provide a valid 17-char VIN (no I/O/Q)." },
        { status: 400 }
      );
    }

    // 1) Decode VIN
    const decoded = await decodeVin(vin);

    // If NHTSA didn’t give us basics, bail nicely
    if (!decoded.make || !decoded.model || !decoded.year) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not resolve vehicle details from VIN.",
          data: decoded.raw ?? null,
        },
        { status: 404 }
      );
    }

    // 2) Guess a segment -> baseline ADR
    const segment = guessSegment(decoded.bodyClass, decoded.trim);
    const adr = segmentToADR(segment);

    // 3) Guess occupancy (replace with your comps/seasonality)
    const occ = occupancyForZip(zip);

    // 4) Compute $$
    const { monthlyGross, monthlyNet } = computeEstimate(adr, occ);

    return NextResponse.json(
      {
        success: true,
        vehicle: {
          vin,
          make: decoded.make,
          model: decoded.model,
          trim: decoded.trim,
          year: decoded.year,
          bodyClass: decoded.bodyClass,
          segment,
        },
        assumptions: {
          baselineADR: adr,
          occupancy: occ,
          daysPerMonth: 30,
          turoFee: 0.25,
        },
        estimate: {
          monthlyGross: Number(monthlyGross.toFixed(2)),
          monthlyNet: Number(monthlyNet.toFixed(2)),
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("estimate-by-vin error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Server error",
      },
      { status: 500 }
    );
  }
}

/**
 * Optional GET for quick testing in the browser:
 * /api/estimate-by-vin?vin=XXXXXXXXXXXXXXX&zip=94105
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vin = (searchParams.get("vin") || "").toUpperCase();
  const zip = searchParams.get("zip");

  if (!vin || !looksLikeVin(vin)) {
    return NextResponse.json(
      { success: false, error: "Provide a valid 17-char VIN via ?vin=" },
      { status: 400 }
    );
  }

  // Reuse POST logic by building a Request
  const proxy = new Request(req.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ vin, zip }),
  });
  // @ts-ignore - call our own POST
  return POST(proxy as NextRequest);
}
