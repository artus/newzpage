import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

/** GET /api/defaults — the house configuration a browser starts from before it has its own. */
export async function GET() {
  try {
    return NextResponse.json(loadConfig(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
