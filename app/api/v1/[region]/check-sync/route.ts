import { NextRequest, NextResponse } from "next/server";
import { isValidRegion } from "@/lib/regions";
import { getUserDetails } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { opsBackendRemovedResponse } from "@/lib/ops-backend-removed";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ region: string }> }
) {
  try {
    const { region } = await params;

    if (!isValidRegion(region)) {
      return NextResponse.json({ error: `Invalid region: ${region}` }, { status: 400 });
    }

    const userDetails = await getUserDetails();
    const permissionCheck = requirePermissionFromSession(
      userDetails.permissions,
      userDetails.role,
      PERMISSIONS.CHECK_SYNC
    );
    if (!permissionCheck.authorized) {
      return NextResponse.json({ error: permissionCheck.error }, { status: 403 });
    }

    return opsBackendRemovedResponse();
  } catch (error) {
    console.error("check-sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
}
