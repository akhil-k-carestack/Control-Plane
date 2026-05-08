import { getDataSource } from "./database/data-source";
import { User } from "./database/entities/User";

export const PERMISSIONS = {
  RABBITMQ: "rabbitmq",
  CHECK_SYNC: "check-sync",
  NUMBERS_NOT_IN_BIFROST: "numbers-not-in-bifrost",
  NUMBERS_NOT_IN_CACHE: "numbers-not-in-cache",
  GENERATE_SIGNED_URL: "generate-signed-url",
  APP_LOGS: "app-logs",
  CALL_DETAILS: "call-details",
  LIST_PRACTICES: "list-practices",
  EXPORT_CALL_DETAILS: "export-call-details",
  SIMWOOD: "simwood",
} as const;

export const ROLES = {
  USER: "user",
  SUPER_ADMIN: "super_admin",
} as const;

/**
 * Check if a user has a specific permission from JWT/session
 * This is more efficient than querying the database on every request
 */
export function hasPermissionFromSession(permissions: string[], role: string | null, permissionName: string): boolean {
  // Super admin has all permissions
  if (role === ROLES.SUPER_ADMIN) {
    return true;
  }

  // Check if permission is in the user's permissions array
  return permissions.includes(permissionName);
}

/**
 * Check if a user has a specific permission (legacy - uses database)
 * Use hasPermissionFromSession for better performance
 */
export async function hasPermission(userId: string, permissionName: string): Promise<boolean> {
  try {
    const db = await getDataSource();
    const userRepository = db.getRepository(User);
    
    // Try to find user by uuid first (since auth system uses uuid as id)
    // If that fails, try by id
    let user = await userRepository.findOne({
      where: { uuid: userId },
      relations: ["role", "role.permissions"],
    });
    
    if (!user) {
      // Try by id if uuid didn't work
      user = await userRepository.findOne({
        where: { id: parseInt(userId) || 0 },
        relations: ["role", "role.permissions"],
      });
    }

    if (!user || !user.role) {
      return false;
    }

    // Super admin has all permissions
    if (user.role.name === ROLES.SUPER_ADMIN) {
      return true;
    }

    // Check if the user's role has the required permission
    return user.role.permissions?.some((permission) => permission.name === permissionName) || false;
  } catch (error) {
    console.error("Error checking permission:", error);
    return false;
  }
}

/**
 * Check if a user has a specific role
 * Note: userId can be either the database id (INT) or uuid (string)
 */
export async function hasRole(userId: string, roleName: string): Promise<boolean> {
  try {
    const db = await getDataSource();
    const userRepository = db.getRepository(User);
    
    // Try to find user by uuid first (since auth system uses uuid as id)
    // If that fails, try by id
    let user = await userRepository.findOne({
      where: { uuid: userId },
      relations: ["role"],
    });
    
    if (!user) {
      // Try by id if uuid didn't work
      user = await userRepository.findOne({
        where: { id: parseInt(userId) || 0 },
        relations: ["role"],
      });
    }

    if (!user || !user.role) {
      return false;
    }

    return user.role.name === roleName;
  } catch (error) {
    console.error("Error checking role:", error);
    return false;
  }
}

/**
 * Get all permissions for a user
 * Note: userId can be either the database id (INT) or uuid (string)
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const db = await getDataSource();
    const userRepository = db.getRepository(User);
    
    // Try to find user by uuid first (since auth system uses uuid as id)
    // If that fails, try by id
    let user = await userRepository.findOne({
      where: { uuid: userId },
      relations: ["role", "role.permissions"],
    });
    
    if (!user) {
      // Try by id if uuid didn't work
      user = await userRepository.findOne({
        where: { id: parseInt(userId) || 0 },
        relations: ["role", "role.permissions"],
      });
    }

    if (!user || !user.role) {
      return [];
    }

    // Super admin has all permissions
    if (user.role.name === ROLES.SUPER_ADMIN) {
      return Object.values(PERMISSIONS);
    }

    // Collect permissions from user's role
    const permissions = new Set<string>();
    user.role.permissions?.forEach((permission) => {
      if (permission.isActive) {
        permissions.add(permission.name);
      }
    });

    return Array.from(permissions);
  } catch (error) {
    console.error("Error getting user permissions:", error);
    return [];
  }
}

/**
 * Middleware helper to check permission from session (JWT-based, recommended)
 * This is faster and more efficient than database queries
 */
export function requirePermissionFromSession(
  permissions: string[],
  role: string | null,
  permissionName: string
): { authorized: boolean; error?: string } {
  const authorized = hasPermissionFromSession(permissions, role, permissionName);
  
  if (!authorized) {
    return {
      authorized: false,
      error: `You do not have permission to access: ${permissionName}`,
    };
  }

  return { authorized: true };
}

/**
 * Middleware helper to check permission (legacy - uses database)
 * Use requirePermissionFromSession for better performance
 */
export async function requirePermission(
  userId: string,
  permissionName: string
): Promise<{ authorized: boolean; error?: string }> {
  const authorized = await hasPermission(userId, permissionName);
  
  if (!authorized) {
    return {
      authorized: false,
      error: `You do not have permission to access: ${permissionName}`,
    };
  }

  return { authorized: true };
}

