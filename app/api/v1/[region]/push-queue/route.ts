import { NextRequest, NextResponse } from "next/server";
import { getGrpcClient, grpcCall, GrpcDisabledError } from "@/lib/grpc-client";
import { isValidRegion } from "@/lib/regions";
import type { PushToRabbitMQQueueRequest, PushToRabbitMQResponse } from "@/types/grpc";
import { getUserDetails, getClientIP } from "@/lib/utils";
import { createAuditLog } from "@/lib/audit";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
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
      PERMISSIONS.RABBITMQ
    );
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { queueName, payloadJson } = body;

    if (!queueName || !payloadJson) {
      return NextResponse.json(
        { error: "queueName and payloadJson are required" },
        { status: 400 }
      );
    }

    // Get client IP and userId for gRPC headers
    const clientIP = getClientIP(request);
    const requestId = crypto.randomUUID();
    const client = getGrpcClient(region, userDetails.id, clientIP, requestId);
    // Convert camelCase to snake_case for proto
    const grpcRequest: any = {
      queueName: queueName,
      payloadJson: typeof payloadJson === "string" ? payloadJson : JSON.stringify(payloadJson),
    };

    const response = await grpcCall<any, PushToRabbitMQResponse>(
      client,
      "PushToRabbitMQQueue",
      grpcRequest
    );

    // Create audit log
    await createAuditLog(
      AUDIT_LOG_ACTIONS.PUSH_QUEUE,
      region,
      requestId,
      { queueName, payloadJson }
    );
    if (!response.success) {
      return NextResponse.json( 
        { error: response.message },
        { status: 400 }
      );
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
