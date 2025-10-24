import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeAll } from 'vitest';
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
  type QueryResult<T = unknown> = { data: T; error: null };

type QueryChain = {
  select: (...args: unknown[]) => QueryChain;
  order: (...args: unknown[]) => QueryChain | Promise<QueryResult<unknown[]>>;
  eq: (...args: unknown[]) => QueryChain | Promise<QueryResult<unknown[]>>;
  in: (...args: unknown[]) => QueryChain | Promise<QueryResult<unknown[]>>;
  limit: (...args: unknown[]) => QueryChain | Promise<QueryResult<unknown[]>>;
  delete: (...args: unknown[]) => Promise<QueryResult<null>>;
  insert: (...args: unknown[]) => Promise<QueryResult<null>>;
};

const chainFactory = (resolveOn: 'order' | 'limit' | 'eq' | 'in'): QueryChain => {
  const chain = {} as QueryChain;

  chain.select = vi.fn().mockReturnValue(chain);

  chain.order = vi.fn(
    resolveOn === 'order'
      ? () => Promise.resolve({ data: [], error: null })
      : () => chain
  );

  chain.eq = vi.fn(
    resolveOn === 'eq'
      ? () => Promise.resolve({ data: [], error: null })
      : () => chain
  );

  chain.in = vi.fn(
    resolveOn === 'in'
      ? () => Promise.resolve({ data: [], error: null })
      : () => chain
  );

  chain.limit = vi.fn(
    resolveOn === 'limit'
      ? () => Promise.resolve({ data: [], error: null })
      : () => chain
  );

  chain.delete = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });

  return chain;
};

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
  // Add these tests to your existing describe block:

it('renders subject filters and allows filtering', async () => {
  render(<FeedClient user={fakeUser} />)
  
  // Wait for subjects to load
  await waitFor(() => {
    expect(screen.getByTestId('subjects-all')).toBeInTheDocument()
  })
  
  // Click 'All' filter
  const allBtn = screen.getByTestId('subjects-all')
  fireEvent.click(allBtn)
  
  expect(allBtn).toHaveClass('bg-gray-900')
})

it('opens and closes mobile chat', async () => {
  render(<FeedClient user={fakeUser} />)
  
  const openChatBtn = screen.getByTestId('btn-open-chat-mobile')
  fireEvent.click(openChatBtn)
  
  await waitFor(() => {
    expect(screen.getByTestId('chat-mobile')).toBeInTheDocument()
  })
  
  // Close it
  const closeBtn = screen.getByText(/Close/i)
  fireEvent.click(closeBtn)
  
  await waitFor(() => {
    expect(screen.queryByTestId('chat-mobile')).not.toBeInTheDocument()
  })
})

it('opens filter sheet on desktop', async () => {
  render(<FeedClient user={fakeUser} />)
  
  const filterBtn = screen.getByTestId('btn-open-filters')
  fireEvent.click(filterBtn)
  
  await waitFor(() => {
    expect(screen.getByTestId('filters-sheet')).toBeInTheDocument()
  })
})

it('renders user menu and logout option', async () => {
  const user = userEvent.setup()
  render(<FeedClient user={fakeUser} />)
  
  const userMenuBtn = screen.getByTestId('btn-user-menu')
  await user.click(userMenuBtn)
  
  await waitFor(() => {
    expect(screen.getByTestId('menu-logout')).toBeInTheDocument()
  })
  
  expect(screen.getByTestId('menu-profile')).toBeInTheDocument()
})

it('renders desktop chat with messages area', async () => {
  render(<FeedClient user={fakeUser} />)
  
  expect(await screen.findByTestId('chat-desktop')).toBeInTheDocument()
  expect(screen.getByTestId('chat-messages')).toBeInTheDocument()
  expect(screen.getByTestId('chat-input')).toBeInTheDocument()
})

it('allows typing and sending a message', async () => {
  render(<FeedClient user={fakeUser} />)
  
  const input = screen.getByTestId('chat-input')
  fireEvent.change(input, { target: { value: 'Hello test' } })
  
  expect(input).toHaveValue('Hello test')
  
  // Simulate Enter key
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })
  
  await waitFor(() => {
    expect(input).toHaveValue('')
  })
})

it('shows FAB buttons for video and post creation', async () => {
  render(<FeedClient user={fakeUser} />)
  
  expect(await screen.findByTestId('fab-video-upload')).toBeInTheDocument()
  expect(screen.getByTestId('fab-create-post')).toBeInTheDocument()
})
})
