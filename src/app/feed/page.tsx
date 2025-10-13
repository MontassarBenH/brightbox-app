
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import FeedClient from './FeedClient'
import type { User } from '@supabase/supabase-js'

export default async function FeedPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  return <FeedClient user={user as User} />
}
