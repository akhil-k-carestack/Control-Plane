import { NextRequest, NextResponse } from "next/server";
import { getUserDetails } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { getPortingRequestDetail } from "@/lib/simwood";
import {
  flattenPortingApiRow,
  resolvePortingMbn,
  extractPortingAssociatedNumbers,
} from "@/lib/porting-row-normalize";

export async function GET(request: NextRequest) {
  try {
    const userDetails = await getUserDetails();
    const permissionCheck = requirePermissionFromSession(
      userDetails.permissions,
      userDetails.role,
      PERMISSIONS.SIMWOOD
    );
    if (!permissionCheck.authorized) {
      return NextResponse.json({ error: permissionCheck.error }, { status: 403 });
    }

    const ref = request.nextUrl.searchParams.get("ref")?.trim() ?? "";
    const kindParam = request.nextUrl.searchParams.get("kind")?.trim().toLowerCase() ?? "";
    const portKind: "local" | "mobile" = kindParam === "mobile" ? "mobile" : "local";

    if (!ref || ref === "—") {
      return NextResponse.json({ error: "Missing or invalid ref" }, { status: 400 });
    }

    const detail = await getPortingRequestDetail(ref, portKind);
    const flat = flattenPortingApiRow(detail);
    const mbn = resolvePortingMbn(flat) || "—";
    const associatedNumbers =
      mbn !== "—"
        ? extractPortingAssociatedNumbers(flat, mbn)
        : extractPortingAssociatedNumbers(flat, "");

    return NextResponse.json({ associatedNumbers: associatedNumbers.trim() });
  } catch (error) {
    console.error("Error fetching porting request detail:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch porting detail" },
      { status: 500 }
    );
  }
}
