/**
 * Single toggle to enable/disable gRPC calls.
 * Set GRPC_ENABLED=false or GRPC_ENABLED=0 to disable.
 * When disabled, getGrpcClient throws GrpcDisabledError and routes should return 503.
 */

export class GrpcDisabledError extends Error {
  constructor() {
    super("gRPC is disabled by configuration (GRPC_ENABLED=false)");
    this.name = "GrpcDisabledError";
  }
}

export function isGrpcEnabled(): boolean {
  const v = process.env.GRPC_ENABLED;
  if (v === undefined || v === "") return true;
  const lower = String(v).toLowerCase();
  return lower === "true" || lower === "1";
}
