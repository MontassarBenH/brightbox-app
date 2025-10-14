import Link from 'next/link'
import { Video, MessageCircle, Lock } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
              <Video className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-6xl font-bold text-white mb-4">BrightBox</h1>
          <p className="text-xl text-purple-200">Share moments with your classmates</p>
        </div>

        <div className="max-w-md mx-auto space-y-4">
          <Link
            href="/login"
            className="block w-full bg-white text-purple-900 py-4 rounded-xl font-semibold text-lg hover:bg-purple-50 transition text-center"
          >
            Sign In
          </Link>
          <Link
            href="/request-invite"
            className="block w-full bg-purple-700/50 backdrop-blur-sm text-white py-4 rounded-xl font-semibold text-lg hover:bg-purple-700/70 transition border border-purple-500/30 text-center"
          >
            Request Invite
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-3 gap-8 max-w-3xl mx-auto">
          <div className="text-center">
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl mb-3 inline-block">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <p className="text-purple-200">Invite Only</p>
          </div>
          <div className="text-center">
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl mb-3 inline-block">
              <Video className="w-8 h-8 text-white" />
            </div>
            <p className="text-purple-200">Short Videos</p>
          </div>
          <div className="text-center">
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl mb-3 inline-block">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <p className="text-purple-200">Real-time Chat</p>
          </div>
        </div>
      </div>
    </div>
  )
}