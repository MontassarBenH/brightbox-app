import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'

class RedirectError extends Error {
  constructor(public location: string) {
    super(`REDIRECT:${location}`)
  }
}

vi.mock('next/navigation', () => {
  return {
    redirect: (to: string) => {
      throw new RedirectError(to)
    },
  }
})
const { redirect } = await import('next/navigation')

const mockFrom = vi.fn()
const mockAuthGetUser = vi.fn()
vi.mock('@/lib/supabase/server', () => {
  return {
    createServerSupabaseClient: vi.fn(async () => ({
      auth: { getUser: mockAuthGetUser },
      from: mockFrom,
    })),
  }
})

import ProfilePage from './page'

describe('ProfilePage (server component)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to /login when there is no authenticated user', async () => {
    // mock auth to return no user
    mockAuthGetUser.mockResolvedValue({ data: { user: null } })

    await expect(ProfilePage({ params: { id: 'someone' } }))
      .rejects.toThrow(/REDIRECT:\/login/)
  })

  it('renders profile content when user exists', async () => {

    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'u@test.com' } },
    })


    const profilesChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'u1',
          username: 'testuser',
          email: 'u@test.com',
          avatar_url: null,
        },
      }),
    }

    // videos
    const videosChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: undefined, 
    }
    videosChain.order.mockResolvedValue({
      data: [
        {
          id: 'v1',
          title: 'My Video',
          mux_playback_id: 'https://example/video',
          created_at: new Date().toISOString(),
        },
      ],
    })

    // posts
    const postsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }
    postsChain.order.mockResolvedValue({
      data: [
        {
          id: 'p1',
          content: 'Hello world',
          background_image: null,
          created_at: new Date().toISOString(),
        },
      ],
    })

    const savesChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [], 
      }),
    }

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profilesChain
        case 'videos':
          return videosChain
        case 'posts':
          return postsChain
        case 'saves':
          return savesChain
        default:
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null }),
            then: undefined,
          }
        }
    })

    const jsx = await ProfilePage({ params: { id: 'u1' } })

    render(jsx)

    expect(await screen.findByText(/testuser/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute('href', '/feed')

    expect(screen.getByRole('heading', { name: /^videos$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^posts$/i })).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: /^saved videos$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^saved posts$/i })).toBeInTheDocument()


    expect(screen.getByText('My Video')).toBeInTheDocument()
    expect(screen.getByText('Hello world')).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: /saved videos/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /saved posts/i })).toBeInTheDocument()
  })
})
