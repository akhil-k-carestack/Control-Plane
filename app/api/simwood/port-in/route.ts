import { NextRequest, NextResponse } from "next/server";
import { getUserDetails } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { createPortInRequest, type PortInRequestEntry, type PortInRequestResult } from "@/lib/simwood";

interface PortInBody {
  entries?: PortInRequestEntry[];
}

const isBlank = (value?: string): boolean => !value || !value.trim();

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

    const body = (await request.json()) as PortInBody;
    const entries = Array.isArray(body.entries) ? body.entries : [];

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "At least one port-in entry is required" },
        { status: 400 }
      );
    }

    const results: PortInRequestResult[] = [];

    for (const entry of entries) {
      if (isBlank(entry?.number) || !entry?.numberType) {
        results.push({
          rowId: entry?.rowId ?? crypto.randomUUID(),
          number: entry?.number ?? "",
          ref: "",
          mbn: entry?.mbn ?? "",
          date: "",
          status: "failed",
          error: "Missing required fields in selected row",
        });
        continue;
      }

      if (entry.numberType === "mobile" && isBlank(entry.pac)) {
        results.push({
          rowId: entry.rowId,
          number: entry.number,
          ref: "",
          mbn: "",
          date: "",
          status: "failed",
          error: "PAC is required for mobile numbers",
        });
        continue;
      }

      if (
        entry.numberType === "local" &&
        (isBlank(entry.mainBillingNumber) ||
          isBlank(entry.currentProvider) ||
          isBlank(entry.lcpCupid) ||
          isBlank(entry.accountNumber) ||
          isBlank(entry.numberOfLines) ||
          isBlank(entry.numberOfChannels) ||
          isBlank(entry.installationFirstName) ||
          isBlank(entry.installationLastName) ||
          isBlank(entry.installationProperty) ||
          isBlank(entry.installationStreet) ||
          isBlank(entry.installationTownCity) ||
          isBlank(entry.installationPostcode) ||
          isBlank(entry.contactEmail))
      ) {
        results.push({
          rowId: entry.rowId,
          number: entry.number,
          ref: "",
          mbn: "",
          date: "",
          status: "failed",
          error: "Missing required local porting fields",
        });
        continue;
      }

      try {
        const result = await createPortInRequest(entry);
        results.push(result);
      } catch (error) {
        results.push({
          rowId: entry.rowId,
          number: entry.number,
          ref: "",
          mbn: entry.mbn ?? "",
          date: "",
          status: "failed",
          error: error instanceof Error ? error.message : "Failed to initiate port-in",
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: results.length,
      successful: results.filter((result) => result.status.toLowerCase() !== "failed").length,
      failed: results.filter((result) => result.status.toLowerCase() === "failed").length,
      results,
    });
  } catch (error) {
    console.error("Error processing port-in batch:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process port-in batch" },
      { status: 500 }
    );
  }
}
