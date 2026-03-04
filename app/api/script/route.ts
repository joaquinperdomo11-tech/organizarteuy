import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const url = process.env.APPS_SCRIPT_URL;
    if (!url) return NextResponse.json({ ok: false, error: "APPS_SCRIPT_URL not configured" }, { status: 500 });

    const body = await request.json();

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
