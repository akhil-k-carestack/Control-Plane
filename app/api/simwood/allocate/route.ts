import { NextRequest, NextResponse } from "next/server";
import { getUserDetails } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { AUDIT_LOG_ACTIONS } from "@/lib/constants";
import { allocateNumber } from "@/lib/simwood";

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

    const body = await request.json();
    const { number, countryCode } = body;

    if (!number || typeof number !== "string") {
      return NextResponse.json(
        { error: "Number is required and must be a string" },
        { status: 400 }
      );
    }

    const requestId = crypto.randomUUID();
    const result = await allocateNumber(number, countryCode);

    await createAuditLog(
      AUDIT_LOG_ACTIONS.SIMWOOD,
      "SIMWOOD",
      requestId,
      { action: "allocate-number", number }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error allocating number:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to allocate number" },
      { status: 500 }
    );
  }
}
