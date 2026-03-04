import { NextResponse } from "next/server";
import { fetchDashboardData } from "@/lib/sheets";

// Revalidate cache every 5 minutes
export const revalidate = parseInt(process.env.REVALIDATE_SECONDS || "300");

export async function GET(request: Request) {
  const noCache = request.url.includes("?t=");
  try {
    const data = await fetchDashboardData();
    return NextResponse.json(data, {
      headers: noCache
        ? { "Cache-Control": "no-store" }
        : { "Cache-Control": `s-maxage=${revalidate}, stale-while-revalidate` },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      {
        error: "Error fetching data from Google Sheets",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
