
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// ---- Browser API stubs for JSDOM ----
beforeAll(() => {
  if (!HTMLElement.prototype.scrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: () => {},
      configurable: true,
      writable: true,
    })
  }

  if (typeof (globalThis as any).IntersectionObserver === 'undefined') {
    ;(globalThis as any).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      constructor() {}
    }
  }

  if (typeof (globalThis as any).ResizeObserver === 'undefined') {
    ;(globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      constructor() {}
    }
  }

  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    value: () => Promise.resolve(),
    configurable: true,
    writable: true,
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    value: () => {},
    configurable: true,
    writable: true,
  })

  if (typeof window.scrollTo !== 'function') {
    window.scrollTo = () => {}
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
