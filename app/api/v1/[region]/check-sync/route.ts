import { NextRequest, NextResponse } from "next/server";
import { getGrpcClient, grpcCall, GrpcDisabledError } from "@/lib/grpc-client";
import { isValidRegion } from "@/lib/regions";
import type { CheckSyncRequest, CheckSyncResponse } from "@/types/grpc";
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
      PERMISSIONS.CHECK_SYNC
    );
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { checkType } = body;

    if (!checkType) {
      return NextResponse.json(
        { error: "checkType is required" },
        { status: 400 }
      );
    }

    // Get client IP and userId for gRPC headers
    const clientIP = getClientIP(request);
    const requestId = crypto.randomUUID();
    const client = getGrpcClient(region, userDetails.id, clientIP, requestId);
    // Convert camelCase to snake_case for proto oneof
    const grpcRequest: any = {};
    if (checkType.device) {
      grpcRequest.device = {
        deviceMake: checkType.device.deviceMake,
        sipAccount: checkType.device.sipAccount,
      };
    } else if (checkType.location) {
      grpcRequest.location = {
        locationId: checkType.location.locationId,
      };
    } else if (checkType.practice) {
      grpcRequest.practice = {
        practiceId: checkType.practice.practiceId,
      };
    } else if (checkType.allBifrost) {
      grpcRequest.allBifrost = {
        confirm: checkType.allBifrost.confirm,
      };
    }

    const response = await grpcCall<any, CheckSyncResponse>(
      client,
      "CheckSync",
      grpcRequest
    );

    // Create audit log
    await createAuditLog(
      AUDIT_LOG_ACTIONS.CHECK_SYNC,
      region,
      requestId,
      { checkType }
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
