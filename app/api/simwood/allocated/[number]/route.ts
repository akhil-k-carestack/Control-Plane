import { NextRequest, NextResponse } from "next/server";
import { getUserDetails } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { AUDIT_LOG_ACTIONS } from "@/lib/constants";
import { deleteNumber } from "@/lib/simwood";

export async function DELETE(
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

    const requestId = crypto.randomUUID();
    await deleteNumber(number);

    await createAuditLog(
      AUDIT_LOG_ACTIONS.SIMWOOD,
      "SIMWOOD",
      requestId,
      { action: "delete-number", number }
    );

    return NextResponse.json({ success: true, message: "Number deleted" });
  } catch (error) {
    console.error("Error deleting number:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete number" },
      { status: 500 }
    );
  }
}
