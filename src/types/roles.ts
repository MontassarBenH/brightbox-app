export type UserRole = 'admin' | 'contributor' | 'viewer';

export interface UserRoleData {
  user_id: string;
  role: UserRole;
  created_at?: string;
}
