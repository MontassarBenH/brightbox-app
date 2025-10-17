// src/app/feed/FeedClient.test.tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import FeedClient from './FeedClient'
import type { User } from '@supabase/supabase-js'

beforeAll(() => {
  // @ts-expect-error - monkey patch for tests
  global.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

// 2) Mock next/navigation router
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

// 3) Mock analytics to no-op
vi.mock('@/lib/analytics', () => ({
  analytics: {
    startSession: vi.fn().mockResolvedValue('session-1'),
    endSession: vi.fn().mockResolvedValue(undefined),
    setupActivityListeners: vi.fn(),
    trackEvent: vi.fn().mockResolvedValue(undefined),
    trackVideoView: vi.fn().mockResolvedValue(undefined),
    trackVideoWatchTime: vi.fn().mockResolvedValue(undefined),
  },
}))

// 4) Supabase client mock
vi.mock('@/lib/supabase/client', () => {
  const chainFactory = (resolveOn: 'order' | 'limit' | 'eq' | 'in') => {
    const result: any = {}
    result.select = vi.fn().mockReturnValue(result)
    result.order = vi.fn(
      resolveOn === 'order'
        ? () => Promise.resolve({ data: [], error: null })
        : () => result
    )
    result.eq = vi.fn(
      resolveOn === 'eq'
        ? () => Promise.resolve({ data: [], error: null })
        : () => result
    )
    result.in = vi.fn(
      resolveOn === 'in'
        ? () => Promise.resolve({ data: [], error: null })
        : () => result
    )
    result.limit = vi.fn(
      resolveOn === 'limit'
        ? () => Promise.resolve({ data: [], error: null })
        : () => result
    )
    result.delete = vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null }))
    result.insert = vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null }))
    return result
  }

  const fromRouter = (table: string) => {
    switch (table) {
      case 'subjects':
        // select('*').order('name')
        return chainFactory('order')
      case 'messages':
        // select('*').order(...).limit(50)
        return chainFactory('limit')
      case 'profiles':
        // select('*').in('id', userIds)
        return chainFactory('in')
      case 'videos':
        // select('*').eq(...).order(...).limit(20)
        return chainFactory('limit')
      case 'posts':
        // select('*').eq(...).order(...).limit(20)
        return chainFactory('limit')
      case 'comments':
        // select('video_id'|'post_id').in(...)
        return chainFactory('in')
      case 'likes':
        // either .eq(...) (for current user's likes) or .in(...) (counts)
        // We'll support both; test code only needs empty arrays anyway.
        return chainFactory('in')
      case 'saves':
        // select('video_id, post_id').eq('user_id', ...)
        return chainFactory('eq')
      default:
        return chainFactory('limit')
    }
  }

  return {
    createClient: () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'u@test.com' } } }),
        signOut: vi.fn().mockResolvedValue({}),
      },
      from: vi.fn((table: string) => fromRouter(table)),
      storage: {
        from: vi.fn(() => ({ remove: vi.fn().mockResolvedValue({}) })),
      },
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      })),
      removeChannel: vi.fn(),
    }),
  }
})

// 5) Minimal user object (cast to User to satisfy typing)
const fakeUser: User = {
  id: 'u1',
  email: 'u@test.com',
  phone: '',
  role: 'authenticated',
  aud: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  identities: [],
  created_at: new Date().toISOString(),
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_anonymous: false,
}

describe('FeedClient', () => {
  it('renders the header and an empty state when there is no content', async () => {
    render(<FeedClient user={fakeUser} />)

    // Header brand is visible
    expect(await screen.findByText(/SchoolFeed/i)).toBeInTheDocument()

    // With all mocked queries returning [], the feed shows "No content yet"
    await waitFor(() => {
      expect(screen.getByText(/No content yet/i)).toBeInTheDocument()
    })
  })
})
