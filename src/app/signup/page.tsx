'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data: invite, error: inviteError } = await supabase
        .from('invites')
        .select('status')
        .eq('email', email.toLowerCase().trim())
        .single()

      console.log('Invite check:', { invite, inviteError })

      if (inviteError || !invite) {
        throw new Error('This email has not requested an invite yet. Please request an invite first.')
      }

      if (invite.status !== 'approved') {
        throw new Error(`Your invite is ${invite.status}. Please wait for approval.`)
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/feed`,
        }
      })

      console.log('Signup result:', { data, signUpError })

      if (signUpError) throw signUpError

      if (data?.user && !data.session) {
        setError('Please check your email to confirm your account.')
      } else if (data.session) {
        window.location.href = '/feed'
      }
    } catch (err) {
      console.error('Signup error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign up'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20">
        <Link href="/" className="text-purple-200 hover:text-white mb-6 inline-block">
          ← Back
        </Link>
        
        <h2 className="text-3xl font-bold text-white mb-2">Create Account</h2>
        <p className="text-purple-200 mb-6">You must have an approved invite to sign up.</p>
        
        <form onSubmit={handleSignup} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-200 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-purple-200 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full bg-white/10 border border-purple-400/30 rounded-lg px-4 py-3 text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-400"
            />
          </div>

          <div>
            <label className="block text-purple-200 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full bg-white/10 border border-purple-400/30 rounded-lg px-4 py-3 text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-400"
            />
            <p className="text-purple-300 text-xs mt-1">At least 6 characters</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-purple-900 py-3 rounded-lg font-semibold hover:bg-purple-50 transition disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-purple-200 text-center mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-white font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}