import { NextRequest, NextResponse } from "next/server";
import { getUserDetails } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { getAvailableStandardNumbers } from "@/lib/simwood";

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
    const pattern = searchParams.get("pattern") || undefined;

    if (quantity < 1 || quantity > 1000) {
      return NextResponse.json(
        { error: "Quantity must be between 1 and 1000" },
        { status: 400 }
      );
    }

    const numbers = await getAvailableStandardNumbers(quantity, pattern);
    return NextResponse.json(numbers);
  } catch (error) {
    console.error("Error fetching standard numbers:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch standard numbers" },
      { status: 500 }
    );
  }
}
