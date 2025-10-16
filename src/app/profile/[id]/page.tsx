import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: userId } = await params; 

  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isOwnProfile = user.id === userId

  // Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, email, avatar_url')
    .eq('id', userId)
    .single()

  // User’s own videos + posts
  const [{ data: videos }, { data: posts }] = await Promise.all([
    supabase
      .from('videos')
      .select('id, title, mux_playback_id, created_at')
      .eq('user_id', userId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false }),
    supabase
      .from('posts')
      .select('id, content, background_image, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ])


type SavedVideo = {
  id: string;
  title: string;
  mux_playback_id: string;
  created_at: string;
};

type SavedPost = {
  id: string;
  content: string;
  background_image: string | null;
  created_at: string;
};

let savedVideos: SavedVideo[] = [];
let savedPosts: SavedPost[] = [];

if (isOwnProfile) {
  const { data: saves } = await supabase
    .from('saves')
    .select('video_id, post_id')
    .eq('user_id', user.id);

  const videoIds = (saves ?? [])
    .map(s => s.video_id)
    .filter((x): x is string => Boolean(x));

  const postIds = (saves ?? [])
    .map(s => s.post_id)
    .filter((x): x is string => Boolean(x));

  if (videoIds.length) {
    const { data: vids } = await supabase
      .from('videos')
      .select('id, title, mux_playback_id, created_at')
      .in('id', videoIds)
      .eq('status', 'ready')
      .order('created_at', { ascending: false });

    savedVideos = (vids ?? []) as SavedVideo[];
  }

  if (postIds.length) {
    const { data: p } = await supabase
      .from('posts')
      .select('id, content, background_image, created_at')
      .in('id', postIds)
      .order('created_at', { ascending: false });

    savedPosts = (p ?? []) as SavedPost[];
  }
}


  const displayName = profile?.username || profile?.email || 'Profile'
  const initial = (displayName?.[0] || 'U').toUpperCase()

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={displayName} />
            ) : (
              <AvatarFallback className="text-lg">{initial}</AvatarFallback>
            )}
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{displayName}</h1>
            <p className="text-sm text-gray-500">
              {(videos?.length ?? 0)} videos · {(posts?.length ?? 0)} posts
              {isOwnProfile ? ` · ${savedVideos.length + savedPosts.length} saved` : null}
            </p>
          </div>
        </div>

        <Link href="/feed" className="text-sm text-purple-600 hover:underline">
          ← Back
        </Link>
      </div>

      {/* Saved videos (only you can see) */}
      {isOwnProfile && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Saved videos</h2>
          {savedVideos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {savedVideos.map((v) => (
                <div key={v.id} className="group">
                  <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                    <video
                      src={v.mux_playback_id}
                      className="w-full h-full object-contain"
                      controls
                      playsInline
                    />
                  </div>
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">{v.title}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(v.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No saved videos yet.</p>
          )}
        </section>
      )}

      {/* Saved posts (only you can see) */}
      {isOwnProfile && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Saved posts</h2>
          {savedPosts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {savedPosts.map((p) => (
                <div key={p.id} className="relative rounded-lg overflow-hidden aspect-[4/5]">
                  {/* Background */}
                  <div
                    className="absolute inset-0 bg-center bg-cover"
                    style={{
                      backgroundImage: p.background_image
                        ? `url(${p.background_image})`
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    }}
                  />
                  {/* Soft overlay */}
                  <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />
                  {/* Centered content */}
                  <div className="absolute inset-0 flex items-center justify-center p-4">
                    <p className="text-white text-center font-semibold leading-relaxed line-clamp-6 text-base md:text-lg">
                      {p.content}
                    </p>
                  </div>
                  {/* Date */}
                  <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded">
                    {new Date(p.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No saved posts yet.</p>
          )}
        </section>
      )}

      {/* Your Videos */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Videos</h2>
        {videos && videos.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {videos.map((v) => (
              <div key={v.id} className="group">
                <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                  <video
                    src={v.mux_playback_id}
                    className="w-full h-full object-contain"
                    controls
                    playsInline
                  />
                </div>
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{v.title}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(v.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No videos yet.</p>
        )}
      </section>

      {/* Your Posts */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Posts</h2>
        {posts && posts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {posts.map((p) => (
              <div key={p.id} className="relative rounded-lg overflow-hidden aspect-[4/5]">
                {/* Background */}
                <div
                  className="absolute inset-0 bg-center bg-cover"
                  style={{
                    backgroundImage: p.background_image
                      ? `url(${p.background_image})`
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  }}
                />
                {/* Soft overlay */}
                <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />
                {/* Centered content */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <p className="text-white text-center font-semibold leading-relaxed line-clamp-6 text-base md:text-lg">
                    {p.content}
                  </p>
                </div>
                {/* Date */}
                <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded">
                  {new Date(p.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No posts yet.</p>
        )}
      </section>
    </main>
  )
}
