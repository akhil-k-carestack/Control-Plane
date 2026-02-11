import { NextRequest, NextResponse } from "next/server";
import { getUserDetails } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { AUDIT_LOG_ACTIONS } from "@/lib/constants";
import { getNumberTrunk, attachNumberToTrunk } from "@/lib/simwood";

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

    const result = await getNumberTrunk(number, countryCode);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching number trunk:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch trunk" },
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

    const body = await request.json();
    const { trunk } = body;

    if (!trunk || typeof trunk !== "string") {
      return NextResponse.json(
        { error: "Trunk is required and must be a string" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const countryCode = searchParams.get("countryCode") ?? undefined;

    const requestId = crypto.randomUUID();
    const result = await attachNumberToTrunk(number, trunk, countryCode);

    await createAuditLog(
      AUDIT_LOG_ACTIONS.SIMWOOD,
      "SIMWOOD",
      requestId,
      { action: "attach-trunk", number, trunk }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error attaching number to trunk:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to attach number to trunk" },
      { status: 500 }
    );
  }
}
