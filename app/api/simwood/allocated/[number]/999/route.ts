import { NextRequest, NextResponse } from "next/server";
import { getUserDetails } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { AUDIT_LOG_ACTIONS } from "@/lib/constants";
import { getEmergency999, putEmergency999, type Emergency999Body } from "@/lib/simwood";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
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

    const { number } = await params;
    if (!number) {
      return NextResponse.json(
        { error: "Number is required" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const countryCode = searchParams.get("countryCode") ?? undefined;

    const result = await getEmergency999(number, countryCode);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching emergency 999:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch emergency details" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
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

    const { number } = await params;
    if (!number) {
      return NextResponse.json(
        { error: "Number is required" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Emergency999Body;

    const requestId = crypto.randomUUID();
    const result = await putEmergency999(number, body);

    await createAuditLog(
      AUDIT_LOG_ACTIONS.SIMWOOD,
      "SIMWOOD",
      requestId,
      { action: "emergency-999", number, body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error configuring emergency 999:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to configure emergency details" },
      { status: 500 }
    );
  }
}
