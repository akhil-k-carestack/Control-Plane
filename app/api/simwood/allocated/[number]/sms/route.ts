import { NextRequest, NextResponse } from "next/server";
import { getUserDetails } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { AUDIT_LOG_ACTIONS } from "@/lib/constants";
import { putSmsConfig } from "@/lib/simwood";

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
    const { endpoint } = body;

    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json(
        { error: "endpoint is required and must be a string" },
        { status: 400 }
      );
    }

    const requestId = crypto.randomUUID();
    await putSmsConfig(number, endpoint);

    await createAuditLog(
      AUDIT_LOG_ACTIONS.SIMWOOD,
      "SIMWOOD",
      requestId,
      { action: "sms-config", number, endpoint }
    );

    return NextResponse.json({ success: true, message: "SMS configuration updated" });
  } catch (error) {
    console.error("Error configuring SMS:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to configure SMS" },
      { status: 500 }
    );
  }
}
