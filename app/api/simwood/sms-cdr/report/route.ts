import { NextRequest, NextResponse } from "next/server";
import { getUserDetails } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { getSmsCdrReport } from "@/lib/simwood";

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

    const { searchParams } = new URL(request.url);
    const quantity = parseInt(searchParams.get("quantity") || "10", 10);

    if (quantity < 1 || quantity > 1000) {
      return NextResponse.json(
        { error: "quantity must be between 1 and 1000" },
        { status: 400 }
      );
    }

    const result = await getSmsCdrReport(quantity);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching SMS CDR report:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch SMS CDR report" },
      { status: 500 }
    );
  }
}
