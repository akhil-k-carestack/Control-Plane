import { NextRequest, NextResponse } from "next/server";
import { getGrpcClient, grpcCall, GrpcDisabledError } from "@/lib/grpc-client";
import { isValidRegion } from "@/lib/regions";
import type { ListPracticesRequest, ListPracticesResponse } from "@/types/grpc";
import { getUserDetails, getClientIP } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";

export async function GET(
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
      PERMISSIONS.LIST_PRACTICES
    );
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: 403 }
      );
    }

    // Get client IP and userId for gRPC headers
    const clientIP = getClientIP(request);
    const requestId = crypto.randomUUID();
    const client = getGrpcClient(region, userDetails.id, clientIP, requestId);
    // Empty request - no parameters needed
    const grpcRequest: ListPracticesRequest = {};

    const response = await grpcCall<ListPracticesRequest, ListPracticesResponse>(
      client,
      "ListPractices",
      grpcRequest
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

