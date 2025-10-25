
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RequestInvitePage from '@/app/request-invite/page'

// Mock Supabase client
const mockInsert = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => {
  return {
    createClient: vi.fn(() => ({
      from: mockFrom,
    })),
  }
})

// Mock Next.js Link
vi.mock('next/link', () => {
  return {
    default: ({ children, href }: { children: React.ReactNode; href: string }) => {
      return <a href={href}>{children}</a>
    },
  }
})

describe('RequestInvitePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mock chain
    mockFrom.mockReturnValue({
      insert: mockInsert,
    })
  })

  it('renders the form with all fields', () => {
    render(<RequestInvitePage />)
    
    expect(screen.getByText('Request Invite')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Why do you want to join?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit request/i })).toBeInTheDocument()
  })

  it('submits form successfully', async () => {
    mockInsert.mockResolvedValue({ error: null })
    
    render(<RequestInvitePage />)
    
    // Fill form
    const emailInput = screen.getByLabelText('Email')
    const reasonInput = screen.getByLabelText('Why do you want to join?')
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(reasonInput, { target: { value: 'I love learning!' } })
    
    // Submit
    const submitButton = screen.getByRole('button', { name: /submit request/i })
    fireEvent.click(submitButton)
    
    // Check success message appears
    await waitFor(() => {
      expect(screen.getByText('Request submitted!')).toBeInTheDocument()
    })
    
    // Verify Supabase was called correctly
    expect(mockInsert).toHaveBeenCalledWith({
      email: 'test@example.com',
      reason: 'I love learning!',
      status: 'pending'
    })
  })

  it('shows error for duplicate email', async () => {
    mockInsert.mockResolvedValue({ 
      error: { code: '23505', message: 'duplicate key' } 
    })
    
    render(<RequestInvitePage />)
    
    const emailInput = screen.getByLabelText('Email')
    fireEvent.change(emailInput, { target: { value: 'duplicate@example.com' } })
    
    const submitButton = screen.getByRole('button', { name: /submit request/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('This email has already requested an invite.')).toBeInTheDocument()
    })
  })

  it('shows generic error on failure', async () => {
    mockInsert.mockResolvedValue({ 
      error: { message: 'Database error' } 
    })
    
    render(<RequestInvitePage />)
    
    const emailInput = screen.getByLabelText('Email')
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    
    const submitButton = screen.getByRole('button', { name: /submit request/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Database error')).toBeInTheDocument()
    })
  })

  it('shows loading state during submission', async () => {
    // Simulate slow request
    mockInsert.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ error: null }), 100))
    )
    
    render(<RequestInvitePage />)
    
    const emailInput = screen.getByLabelText('Email')
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    
    const submitButton = screen.getByRole('button', { name: /submit request/i })
    fireEvent.click(submitButton)
    
    // Button should show loading text and be disabled
    expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled()
    
    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText('Request submitted!')).toBeInTheDocument()
    })
  })

  it('renders back link to home', () => {
    render(<RequestInvitePage />)
    
    const backLink = screen.getByText('← Back')
    expect(backLink).toBeInTheDocument()
    expect(backLink.closest('a')).toHaveAttribute('href', '/')
  })

  it('requires email to submit form', () => {
    render(<RequestInvitePage />)
    
    const emailInput = screen.getByLabelText('Email') as HTMLInputElement
    expect(emailInput).toBeRequired()
  })

  it('clears error when submitting again', async () => {
    // First submission fails
    mockInsert.mockResolvedValueOnce({ 
      error: { message: 'Server error' } 
    })
    
    render(<RequestInvitePage />)
    
    const emailInput = screen.getByLabelText('Email')
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))
    
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
    
    // Second submission succeeds
    mockInsert.mockResolvedValueOnce({ error: null })
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))
    
    // Error should be cleared and success shown
    await waitFor(() => {
      expect(screen.queryByText('Server error')).not.toBeInTheDocument()
      expect(screen.getByText('Request submitted!')).toBeInTheDocument()
    })
  })
})


// ============================================
// BONUS: Integration-style test
// ============================================

describe('RequestInvitePage - User Journey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    mockFrom.mockReturnValue({
      insert: mockInsert,
    })
  })

  it('complete user journey: fill form, submit, see success', async () => {
    mockInsert.mockResolvedValue({ error: null })
    
    render(<RequestInvitePage />)
    
    // 1. User sees the form
    expect(screen.getByText('Request Invite')).toBeInTheDocument()
    expect(screen.getByText(/we'll review your request/i)).toBeInTheDocument()
    
    // 2. User fills out email
    const emailInput = screen.getByLabelText('Email')
    fireEvent.change(emailInput, { target: { value: 'newuser@school.com' } })
    
    // 3. User fills out reason (optional)
    const reasonInput = screen.getByLabelText('Why do you want to join?')
    fireEvent.change(reasonInput, { target: { value: 'I want to learn math!' } })
    
    // 4. User clicks submit
    const submitButton = screen.getByRole('button', { name: /submit request/i })
    expect(submitButton).not.toBeDisabled()
    fireEvent.click(submitButton)
    
    // 5. User sees loading state
    expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled()
    
    // 6. User sees success message
    await waitFor(() => {
      expect(screen.getByText('Request submitted!')).toBeInTheDocument()
      expect(screen.getByText(/we'll review your request and email you/i)).toBeInTheDocument()
    })
    
    // 7. User can go back home
    const returnLink = screen.getByText('Return to home')
    expect(returnLink).toBeInTheDocument()
    expect(returnLink.closest('a')).toHaveAttribute('href', '/')
    
    // 8. Form is no longer visible
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })

  it('handles network error gracefully', async () => {
    mockInsert.mockRejectedValue(new Error('Network error'))
    
    render(<RequestInvitePage />)
    
    const emailInput = screen.getByLabelText('Email')
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))
    
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
    
    // Form should still be visible for retry
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })
})


// ============================================
// vitest.config.ts (if you need it)
// ============================================

/*
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
*/


// ============================================
// vitest.setup.ts
// ============================================

/*
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

afterEach(() => {
  cleanup()
})
*/


// ============================================
// package.json scripts
// ============================================

/*
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  },
  "devDependencies": {
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.1.5",
    "@vitejs/plugin-react": "^4.2.1",
    "vitest": "^1.0.4",
    "@vitest/ui": "^1.0.4",
    "jsdom": "^23.0.1"
  }
}
*/