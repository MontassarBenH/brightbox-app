'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
    const res = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    // Guard: res can be undefined in tests if a mock is misconfigured
    if (!res) {
      throw new Error('Auth call returned no result')
    }

    const { data, error: loginError } = res
    if (loginError) throw loginError
    if (!data?.user || !data?.session) throw new Error('Missing session after login')

          const adminRes = await supabase
            .from('admin_users')
            .select('user_id')
            .eq('user_id', data.user.id)
            .maybeSingle()

          if (!adminRes) {
            window.location.href = '/feed'
            return
          }

          const { data: adminRow, error: adminErr } = adminRes

          // If query errors, fall back to normal feed
          if (adminErr) {
            console.warn('admin check failed:', adminErr)
            window.location.href = '/feed'
            return
          }

          // Redirect based on presence in admin_users
          if (adminRow) {
            window.location.href = '/admin'
          } else {
            window.location.href = '/feed'
          }

      } catch (err: unknown) {
        console.error('Login error:', err);

        const getMsg = (e: unknown): string | null => {
          if (typeof e === 'object' && e && 'message' in e) {
            const m = (e as { message?: unknown }).message;
            return typeof m === 'string' ? m : null;
          }
          return null;
        };

        let msg = 'Failed to login';
        const raw = getMsg(err)?.toLowerCase() || '';

        if (raw.includes('email not confirmed')) {
          msg = 'Please confirm your email first. Check your inbox (and spam).';
        } else if (raw.includes('invalid login credentials')) {
          msg = 'Invalid email or password. If you signed up with a magic link or Google, use "Sign in with magic link" below.';
        } else {
          msg = getMsg(err) ?? msg;
        }

        setError(msg);
      } finally {
        setLoading(false);
      }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20">
        <Link href="/" className="text-purple-200 hover:text-white mb-6 inline-block">
          ← Back
        </Link>

        <h2 className="text-3xl font-bold text-white mb-6">Welcome Back</h2>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-200 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-purple-200 mb-2">Email</label>
            <input
              id="email" 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full bg-white/10 border border-purple-400/30 rounded-lg px-4 py-3 text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-400"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-purple-200 mb-2">Password</label>
            <input
              id="password" 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-white/10 border border-purple-400/30 rounded-lg px-4 py-3 text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-purple-900 py-3 rounded-lg font-semibold hover:bg-purple-50 transition disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-purple-200 text-center mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-white font-semibold hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
