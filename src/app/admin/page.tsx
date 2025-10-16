import { redirect } from 'next/navigation';
import AdminDashboard from '@/app/admin/dashboard/page';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!adminUser) {
    redirect('/feed'); 
  }

  return <AdminDashboard />;
}
