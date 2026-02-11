import { NextRequest, NextResponse } from "next/server";
import { getGrpcClient, grpcCall, GrpcDisabledError } from "@/lib/grpc-client";
import { isValidRegion } from "@/lib/regions";
import type { GetCompleteCallDetailsRequest, GetCompleteCallDetailsResponse } from "@/types/grpc";
import { getUserDetails, getClientIP } from "@/lib/utils";
import { createAuditLog } from "@/lib/audit";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { AUDIT_LOG_ACTIONS } from "@/lib/constants";
import { getCacheValue, setCacheValue, getCompleteCallDetailsCacheKey } from "@/lib/cache";

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
      PERMISSIONS.EXPORT_CALL_DETAILS
    );
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { callId, practiceId } = body;

    if (!callId) {
      return NextResponse.json(
        { error: "callId is required" },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = getCompleteCallDetailsCacheKey(region, callId, practiceId);
    const cachedResponse = await getCacheValue<GetCompleteCallDetailsResponse>(cacheKey);

    if (cachedResponse) {
      // Return cached response (no audit log for cache hits to avoid spam)
      return NextResponse.json(cachedResponse);
    }

    // Cache miss - fetch from gRPC
    // Get client IP and userId for gRPC headers
    const clientIP = getClientIP(request);
    const requestId = crypto.randomUUID();
    const client = getGrpcClient(region, userDetails.id, clientIP, requestId);
    
    // Proto loader converts camelCase to snake_case automatically
    const grpcRequest: GetCompleteCallDetailsRequest = {
      callId: callId,
      practiceId: practiceId || undefined,
    };

    const response = await grpcCall<GetCompleteCallDetailsRequest, GetCompleteCallDetailsResponse>(
      client,
      "GetCompleteCallDetails",
      grpcRequest
    );

    // Cache the response for 10 minutes (600 seconds)
    if (response.success) {
      await setCacheValue(cacheKey, response, 600);
    }

    // Create audit log
    await createAuditLog(
      AUDIT_LOG_ACTIONS.EXPORT_CALL_DETAILS,
      region,
      requestId,
      { callId, practiceId }
    );

    return NextResponse.json(response);
  } catch (error: unknown) {
    if (error instanceof GrpcDisabledError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Failed to get complete call details";
    console.error("gRPC error:", error);
    return NextResponse.json(
      { error: message, success: false, message },
      { status: 500 }
    );
  }
}

