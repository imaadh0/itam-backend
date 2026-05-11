export type UserRole = "ADMIN" | "IT_MANAGER" | "IT_STAFF";

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
  name: string;
}
