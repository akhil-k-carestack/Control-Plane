import { NextRequest, NextResponse } from "next/server";
import { getGrpcClient, grpcCall, GrpcDisabledError } from "@/lib/grpc-client";
import { isValidRegion } from "@/lib/regions";
import type { GetNumbersNotInBifrostRequest, GetNumbersNotInBifrostResponse } from "@/types/grpc";
import { getUserDetails, getClientIP } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { AUDIT_LOG_ACTIONS } from "@/lib/constants";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ region: string }> }
) {
  try {
    const { region } = await params;
    
    if (!isValidRegion(region)) {
      return NextResponse.json(
        { error: `Invalid region: ${region}` },
        { status: 400 }
      );
    }

    // Check permissions from JWT (faster than DB query)
    const userDetails = await getUserDetails();
    const permissionCheck = requirePermissionFromSession(
      userDetails.permissions,
      userDetails.role,
      PERMISSIONS.NUMBERS_NOT_IN_BIFROST
    );
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { trunkSid } = body;

    if (!trunkSid) {
      return NextResponse.json(
        { error: "trunkSid is required" },
        { status: 400 }
      );
    }

    // Get client IP and userId for gRPC headers
    const clientIP = getClientIP(request);
    const requestId = crypto.randomUUID();
    const client = getGrpcClient(region, userDetails.id, clientIP, requestId);
    // Convert camelCase to snake_case for proto
    const grpcRequest: any = {
      trunk_sid: trunkSid,
    };

    const response = await grpcCall<any, GetNumbersNotInBifrostResponse>(
      client,
      "GetNumbersNotInBifrost",
      grpcRequest
    );

    // Create audit log
    await createAuditLog(
      AUDIT_LOG_ACTIONS.GET_NUMBERS_NOT_IN_BIFROST,
      region,
      requestId,
      { trunkSid }
    );

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof GrpcDisabledError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("gRPC error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
