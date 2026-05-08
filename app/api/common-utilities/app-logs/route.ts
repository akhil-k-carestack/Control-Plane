import { NextRequest, NextResponse } from "next/server";
import { getUserDetails } from "@/lib/utils";
import { requirePermissionFromSession, PERMISSIONS } from "@/lib/permissions";
import { createAppLogDocument } from "@/lib/firebase-admin";

interface CreateAppLogBody {
  agentuuid?: string;
}

export async function POST(request: NextRequest) {
  try {
    const userDetails = await getUserDetails();
    const permissionCheck = requirePermissionFromSession(
      userDetails.permissions,
      userDetails.role,
      PERMISSIONS.APP_LOGS
    );
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: 403 }
      );
    }

    const body = (await request.json()) as CreateAppLogBody;
    const agentuuid = String(body.agentuuid ?? "").trim();
    if (!agentuuid) {
      return NextResponse.json(
        { error: "agentuuid is required" },
        { status: 400 }
      );
    }

    const documentId = await createAppLogDocument(agentuuid);
    return NextResponse.json({
      success: true,
      message: "App log document created successfully",
      data: { documentId, agentuuid },
    });
  } catch (error) {
    console.error("Error creating app log document:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create app log document" },
      { status: 500 }
    );
  }
}
