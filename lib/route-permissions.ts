import { PERMISSIONS } from "./permissions";

/**
 * Map routes to required permissions
 */
export const ROUTE_PERMISSIONS: Record<string, string> = {
  "/provision/check-sync": PERMISSIONS.CHECK_SYNC,
  "/common-utilities/rabbitmq": PERMISSIONS.RABBITMQ,
  "/common-utilities/generate-signed-url": PERMISSIONS.GENERATE_SIGNED_URL,
  "/common-utilities/app-logs": PERMISSIONS.APP_LOGS,
  "/call-details": PERMISSIONS.CALL_DETAILS,
  "/numbers": PERMISSIONS.NUMBERS_NOT_IN_BIFROST,
  "/numbers-not-in-number-cache": PERMISSIONS.NUMBERS_NOT_IN_CACHE,
  "/twilio": PERMISSIONS.RABBITMQ, // Placeholder - adjust when Twilio permissions are added
  "/simwood": PERMISSIONS.SIMWOOD,
  "/simwood/port-in": PERMISSIONS.SIMWOOD,
  "/audit-logs": "super_admin", // Special route - only super_admin can access
};

/**
 * Get required permission for a route
 */
export function getRequiredPermission(route: string): string | null {
  return ROUTE_PERMISSIONS[route] || null;
}

/**
 * Check if user has permission for a route
 */
export function hasRoutePermission(
  permissions: string[],
  role: string | null,
  route: string
): boolean {
  const requiredPermission = getRequiredPermission(route);
  
  // If no permission required, allow access
  if (!requiredPermission) {
    return true;
  }

  // Special case: super_admin route requires super_admin role
  if (requiredPermission === "super_admin") {
    return role === "super_admin";
  }

  // Super admin has all permissions (except special routes handled above)
  if (role === "super_admin") {
    return true;
  }

  // Check if user has the required permission
  return permissions.includes(requiredPermission);
}

