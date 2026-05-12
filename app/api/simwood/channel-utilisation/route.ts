import { NextRequest, NextResponse } from "next/server";
import { getUserDetails } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { getChannelHistory, type ChannelHistoryInterval } from "@/lib/simwood";

const INTERVALS = new Set<string>(["1m", "5m", "10m", "1h"]);
const TRAFFIC = new Set<string>(["both", "inbound", "outbound"]);

export async function GET(request: NextRequest) {
  try {
    const userDetails = await getUserDetails();
    const permissionCheck = requirePermissionFromSession(
      userDetails.permissions,
      userDetails.role,
      PERMISSIONS.SIMWOOD
    );
    if (!permissionCheck.authorized) {
      return NextResponse.json({ error: permissionCheck.error }, { status: 403 });
    }

    const interval = request.nextUrl.searchParams.get("interval") ?? "10m";
    const traffic = request.nextUrl.searchParams.get("traffic") ?? "both";

    if (!INTERVALS.has(interval)) {
      return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
    }
    if (!TRAFFIC.has(traffic)) {
      return NextResponse.json({ error: "Invalid traffic filter" }, { status: 400 });
    }

    const data = await getChannelHistory(
      interval as ChannelHistoryInterval,
      traffic as "both" | "inbound" | "outbound"
    );
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error fetching channel utilisation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch channel utilisation" },
      { status: 500 }
    );
  }
}
