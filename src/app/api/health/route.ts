import { NextResponse } from "next/server";

// make the file a module no matter what
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true });
}
