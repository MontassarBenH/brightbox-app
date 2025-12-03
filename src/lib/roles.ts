import { SupabaseClient } from '@supabase/supabase-js';
import { UserRole } from '@/types/roles';

export async function getUserRole(supabase: SupabaseClient, userId: string): Promise<UserRole> {
    try {
        // 1. Check if user is an admin
        const { data: adminUser } = await supabase
            .from('admin_users')
            .select('role')
            .eq('user_id', userId)
            .maybeSingle();

        if (adminUser) {
            return 'admin';
        }

        // 2. Check for specific application role
        const { data: userRole } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .maybeSingle();

        if (userRole?.role === 'contributor') {
            return 'contributor';
        }

        // 3. Default to viewer
        return 'viewer';
    } catch (error) {
        console.error('Error fetching user role:', error);
        return 'viewer';
    }
}

export function canPost(role: UserRole): boolean {
    return role === 'admin' || role === 'contributor';
}
