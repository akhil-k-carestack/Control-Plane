import { NextRequest, NextResponse } from "next/server";
import { getUserDetails } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { getTrunks } from "@/lib/simwood";

export async function GET(request: NextRequest) {
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

    const trunks = await getTrunks();

    return NextResponse.json(trunks);
  } catch (error) {
    console.error("Error fetching trunks:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch trunks" },
      { status: 500 }
    );
  }
}
