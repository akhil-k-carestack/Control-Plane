import { NextResponse } from "next/server";

export const OPS_BACKEND_REMOVED_MESSAGE =
  "The legacy operations backend is no longer integrated with this control plane.";

export function opsBackendRemovedResponse(): NextResponse {
  return NextResponse.json({ error: OPS_BACKEND_REMOVED_MESSAGE }, { status: 410 });
}
