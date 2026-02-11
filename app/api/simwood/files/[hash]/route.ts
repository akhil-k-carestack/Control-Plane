import { NextRequest, NextResponse } from "next/server";
import { getUserDetails } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { getFileByHash } from "@/lib/simwood";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
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

    const { hash } = await params;
    if (!hash) {
      return NextResponse.json(
        { error: "Hash is required" },
        { status: 400 }
      );
    }

    const data = await getFileByHash(hash);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching numbers from file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch numbers" },
      { status: 500 }
    );
  }
}
