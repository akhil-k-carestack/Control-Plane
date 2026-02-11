import { NextRequest, NextResponse } from "next/server";
import { getUserDetails } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { validateNumber } from "@/lib/simwood";

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
    const number = searchParams.get("number");
    const countryCode = searchParams.get("countryCode") ?? undefined;

    if (!number) {
      return NextResponse.json(
        { error: "number is required" },
        { status: 400 }
      );
    }

    const result = await validateNumber(number, countryCode);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error validating number:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to validate number" },
      { status: 500 }
    );
  }
}
