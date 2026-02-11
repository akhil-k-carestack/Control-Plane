import { NextRequest, NextResponse } from "next/server";
import { getGrpcClient, grpcCall, GrpcDisabledError } from "@/lib/grpc-client";
import { isValidRegion } from "@/lib/regions";
import type { GetCallDetailsRequest, GetCallDetailsResponse } from "@/types/grpc";
import { getUserDetails, getClientIP } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { AUDIT_LOG_ACTIONS } from "@/lib/constants";
import { generateGrafanaExploreUrl } from "@/lib/grafana";

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
      PERMISSIONS.CALL_DETAILS
    );
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { practiceId, callId } = body;

    // Validate inputs
    if (!practiceId || typeof practiceId !== "string") {
      return NextResponse.json(
        { error: "practiceId is required and must be a string" },
        { status: 400 }
      );
    }

    if (!callId || typeof callId !== "string") {
      return NextResponse.json(
        { error: "callId is required and must be a string" },
        { status: 400 }
      );
    }

    // Get client IP and userId for gRPC headers
    const clientIP = getClientIP(request);
    const requestId = crypto.randomUUID();
    const client = getGrpcClient(region, userDetails.id, clientIP, requestId);
    
    // Convert camelCase to snake_case for gRPC
    const grpcRequest: any = {
      practiceId: practiceId,
      callId: callId,
    };

    const response = await grpcCall<any, GetCallDetailsResponse>(
      client,
      "GetCallDetails",
      grpcRequest
    );

    // Create audit log
    await createAuditLog(
      AUDIT_LOG_ACTIONS.GET_CALL_DETAILS,
      region,
      requestId,
      { practiceId, callId }
    );
    // console.log("response", response);
    // add grafanaUrl to the response
    if(response?.callDetails) {
      const grafanaUrl = generateGrafanaExploreUrl({
        region: region as any,
        startTime: response?.callDetails?.callTime ? new Date(response?.callDetails?.callTime).getTime() : new Date().getTime(),
        endTime: response?.callDetails?.callEndTime ? new Date(response?.callDetails?.callEndTime).getTime() : new Date().getTime(),
        callId: response?.callDetails?.callId as string,
        filename: "/home/csiq/.pm2/logs/CallController-out.log",
      });
      response.callDetails!.grafanaUrl = grafanaUrl;
    }

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

