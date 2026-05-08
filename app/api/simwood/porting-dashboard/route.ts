import { NextResponse } from "next/server";
import { getUserDetails } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { getPortingRequests } from "@/lib/simwood";

export async function GET() {
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

    const data = await getPortingRequests();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error fetching porting dashboard data:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch porting dashboard data" },
      { status: 500 }
    );
  }
}
