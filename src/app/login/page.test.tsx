import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import LoginPage from './page';

type AdminQueryChain = {
  select: (...args: unknown[]) => AdminQueryChain
  eq: (...args: unknown[]) => AdminQueryChain
  maybeSingle: () => Promise<{ data: { user_id: string } | null; error: { message: string } | null }>
}

type FromReturn = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

type SupabaseMock = {
  auth: {
    signInWithPassword: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
};

let supabaseMock: SupabaseMock;

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => supabaseMock,
}));

describe('LoginPage', () => {
  beforeEach(() => {
    const fromReturn: FromReturn = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    };

    supabaseMock = {
      auth: {
        signInWithPassword: vi.fn(),
      },
      from: vi.fn(() => fromReturn),
    };

    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  it('renders email & password fields and submit button', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows a friendly error for invalid credentials', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    })

    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() =>
      expect(
        screen.getByText(/invalid email or password\. if you signed up with a magic link or google/i)
      ).toBeInTheDocument()
    )
  })

  it('redirects to /admin when the user is in admin_users', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-123' }, session: { access_token: 'tok' } },
      error: null,
    })

    // chain for admin lookup -> found
   const chain: AdminQueryChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: 'user-123' }, error: null }),
}
supabaseMock.from.mockReturnValueOnce(chain)

    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@example.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pass1234' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(window.location.href).toContain('/admin')
    })
  })

  it('redirects to /feed when the user is not an admin', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-abc' }, session: { access_token: 'tok' } },
      error: null,
    })
    
// 2) not admin
  const chain: AdminQueryChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
}
supabaseMock.from.mockReturnValueOnce(chain) // 

    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pass1234' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(window.location.href).toContain('/feed')
    })
  })

  it('falls back to /feed if the admin check errors', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-err' }, session: { access_token: 'tok' } },
      error: null,
    })

    // chain for admin lookup -> error
    const chain: AdminQueryChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'policy denied' } }),
}
supabaseMock.from.mockReturnValueOnce(chain) //

    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user2@example.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pass1234' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(window.location.href).toContain('/feed')
    })
  })
})
