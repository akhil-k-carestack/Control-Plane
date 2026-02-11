import { NextRequest, NextResponse } from "next/server";
import { getUserDetails } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { getVoiceCdr, type VoiceCdrRequest } from "@/lib/simwood";

const MAX_DATE_RANGE_DAYS = 30;
const ALLOWED_SIZES = [10, 100, 1000, 10000];

function parseDate(s: string): Date {
  const d = new Date(s);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${s}`);
  }
  return d;
}

export async function POST(request: NextRequest) {
  try {
    const userDetails = await getUserDetails();
    const permissionCheck = requirePermissionFromSession(
      userDetails.permissions,
      userDetails.role,
      PERMISSIONS.SIMWOOD
    );
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: 403 }
      );
    }

    const body = (await request.json()) as VoiceCdrRequest;

    const { date_start, date_end, size = 100, page = 1, direction = "both", duration_min, duration_max } = body;

    if (!date_start || !date_end) {
      return NextResponse.json(
        { error: "date_start and date_end are required" },
        { status: 400 }
      );
    }

    const start = parseDate(date_start);
    const end = parseDate(date_end);
    const rangeDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (rangeDays > MAX_DATE_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Date range must not exceed ${MAX_DATE_RANGE_DAYS} days` },
        { status: 400 }
      );
    }

    if (!ALLOWED_SIZES.includes(size)) {
      return NextResponse.json(
        { error: `size must be one of: ${ALLOWED_SIZES.join(", ")}` },
        { status: 400 }
      );
    }

    const payload: VoiceCdrRequest = {
      duration_min: duration_min ?? 0,
      duration_max: duration_max ?? 99999,
      date_start,
      date_end,
      size,
      page: page >= 1 ? page : 1,
      direction,
    };

    const result = await getVoiceCdr(payload);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching voice CDR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch voice CDR" },
      { status: 500 }
    );
  }
}
