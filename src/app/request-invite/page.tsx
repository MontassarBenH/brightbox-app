'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function RequestInvitePage() {
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error: submitError } = await supabase
        .from('invites')
        .insert({ email, reason, status: 'pending' })

      if (submitError) {
        if (submitError.code === '23505') {
          throw new Error('This email has already requested an invite.')
        }
        throw submitError
      }

      setSuccess(true)
      setEmail('')
      setReason('')
    } catch (err) {
      const msg =
        (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string')
          ? (err as any).message
          : 'Failed to submit request'

      setError(msg)
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
        
        <h2 className="text-3xl font-bold text-white mb-2">Request Invite</h2>
        <p className="text-purple-200 mb-6">We&apos;ll review your request and send you an invite if approved.</p>
        
        {success ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-200">
            <p className="font-semibold mb-2">Request submitted!</p>
            <p className="text-sm">We&apos;ll review your request and email you if approved.</p>
            <Link href="/" className="inline-block mt-4 text-white hover:underline">
              Return to home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-200 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-purple-200 mb-2">
                Email
              </label>
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
              <label htmlFor="reason" className="block text-purple-200 mb-2">
                Why do you want to join?
              </label>
              <textarea
                id="reason" 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Tell us a bit about yourself..."
                rows={4}
                className="w-full bg-white/10 border border-purple-400/30 rounded-lg px-4 py-3 text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-purple-900 py-3 rounded-lg font-semibold hover:bg-purple-50 transition disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}