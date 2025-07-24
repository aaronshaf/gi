import { afterEach, beforeAll } from 'bun:test'
import { setupFetchMock } from './mocks/fetch-mock'

// Setup Bun's native fetch mocking before all tests
beforeAll(() => {
  setupFetchMock()
})

// Clean up after each test (Bun automatically restores mocks)
afterEach(() => {
  // Bun automatically handles mock cleanup
  // But we can reset if needed
})
