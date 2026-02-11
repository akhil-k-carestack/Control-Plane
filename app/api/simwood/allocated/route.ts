import { NextRequest, NextResponse } from "next/server";
import { getUserDetails } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { getAllocatedNumbers } from "@/lib/simwood";

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
    const { quantity } = body;

    if (!quantity || typeof quantity !== "number" || quantity < 1 || quantity > 1000) {
      return NextResponse.json(
        { error: "Quantity must be a number between 1 and 1000" },
        { status: 400 }
      );
    }

    const result = await getAllocatedNumbers(quantity);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching allocated numbers:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch allocated numbers" },
      { status: 500 }
    );
  }
}
