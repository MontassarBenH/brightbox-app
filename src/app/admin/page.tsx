import { redirect } from 'next/navigation';
import AdminDashboard from '@/app/admin/dashboard/page';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!adminRow) redirect('/');

  return <AdminDashboard />;
}
