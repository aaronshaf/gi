import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Schema } from '@effect/schema'
import { ChangeInfo } from '@/schemas/gerrit'
import { restoreFetch, setupFetchMock } from '../../mocks/fetch-mock'

describe('fetch-mock', () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalFetch = global.fetch
    setupFetchMock()
  })

  afterEach(() => {
    global.fetch = originalFetch
    restoreFetch()
  })

  describe('Authentication', () => {
    test('should return 401 when no authorization header is provided', async () => {
      const response = await fetch('https://gerrit.example.com/a/changes/12345')

      expect(response.status).toBe(401)
      const text = await response.text()
      expect(text).toContain('Unauthorized')
    })

    test('should return 401 when authorization header is invalid', async () => {
      const response = await fetch('https://gerrit.example.com/a/changes/12345', {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      })

      expect(response.status).toBe(401)
    })

    test('should accept Basic auth header', async () => {
      const response = await fetch('https://gerrit.example.com/a/changes/12345', {
        headers: {
          Authorization: `Basic ${btoa('user:pass')}`,
        },
      })

      expect(response.status).toBe(200)
    })
  })

  describe('Accounts endpoint', () => {
    test('should return mock account for /a/accounts/self', async () => {
      const response = await fetch('https://gerrit.example.com/a/accounts/self', {
        headers: {
          Authorization: `Basic ${btoa('user:pass')}`,
        },
      })

      expect(response.status).toBe(200)
      const text = await response.text()
      expect(text.startsWith(")]}'\n")).toBe(true)

      const account = JSON.parse(text.substring(5))
      expect(account).toHaveProperty('_account_id')
      expect(account).toHaveProperty('name')
      expect(account).toHaveProperty('email')
    })
  })

  describe('Changes endpoints', () => {
    test('should list changes when querying with ?q=', async () => {
      const response = await fetch('https://gerrit.example.com/a/changes/?q=status:open', {
        headers: {
          Authorization: `Basic ${btoa('user:pass')}`,
        },
      })

      expect(response.status).toBe(200)
      const text = await response.text()
      expect(text.startsWith(")]}'\n")).toBe(true)

      const changes = JSON.parse(text.substring(5))
      expect(Array.isArray(changes)).toBe(true)
      expect(changes.length).toBeGreaterThan(0)
    })

    test('should get single change by ID', async () => {
      const response = await fetch('https://gerrit.example.com/a/changes/12345', {
        headers: {
          Authorization: `Basic ${btoa('user:pass')}`,
        },
      })

      expect(response.status).toBe(200)
      const text = await response.text()
      const change = JSON.parse(text.substring(5))

      // Validate against schema
      const validated = Schema.decodeUnknownSync(ChangeInfo)(change)
      expect(validated).toHaveProperty('project')
      expect(validated).toHaveProperty('branch')
      expect(validated).toHaveProperty('change_id')
    })

    test('should return 404 for notfound change ID', async () => {
      const response = await fetch('https://gerrit.example.com/a/changes/notfound', {
        headers: {
          Authorization: `Basic ${btoa('user:pass')}`,
        },
      })

      expect(response.status).toBe(404)
      const text = await response.text()
      expect(text).toContain('Not found')
    })
  })

  describe('Files endpoints', () => {
    test('should list files for a change', async () => {
      const response = await fetch(
        'https://gerrit.example.com/a/changes/12345/revisions/current/files',
        {
          headers: {
            Authorization: `Basic ${btoa('user:pass')}`,
          },
        },
      )

      expect(response.status).toBe(200)
      const text = await response.text()
      const files = JSON.parse(text.substring(5))

      expect(typeof files).toBe('object')
      expect(Object.keys(files).length).toBeGreaterThan(0)
    })

    test('should get file diff', async () => {
      const response = await fetch(
        'https://gerrit.example.com/a/changes/12345/revisions/current/files/src%2Fmain.ts/diff',
        {
          headers: {
            Authorization: `Basic ${btoa('user:pass')}`,
          },
        },
      )

      expect(response.status).toBe(200)
      const text = await response.text()
      const diff = JSON.parse(text.substring(5))

      expect(diff).toHaveProperty('change_type')
      expect(diff).toHaveProperty('content')
      expect(diff).toHaveProperty('diff_header')
      expect(diff.change_type).toBe('MODIFIED')
    })

    test('should get file content', async () => {
      const response = await fetch(
        'https://gerrit.example.com/a/changes/12345/revisions/current/files/src%2Fmain.ts/content',
        {
          headers: {
            Authorization: `Basic ${btoa('user:pass')}`,
          },
        },
      )

      expect(response.status).toBe(200)
      const base64Content = await response.text()

      // Decode base64
      const content = atob(base64Content)
      expect(content).toContain('function main()')
      expect(content).toContain('console.log')
      expect(content).toContain('process.exit(0)')
    })
  })

  describe('Patch endpoint', () => {
    test('should get patch content', async () => {
      const response = await fetch(
        'https://gerrit.example.com/a/changes/12345/revisions/current/patch',
        {
          headers: {
            Authorization: `Basic ${btoa('user:pass')}`,
          },
        },
      )

      expect(response.status).toBe(200)
      const base64Patch = await response.text()

      // Decode base64
      const patch = atob(base64Patch)
      expect(patch).toContain('--- a/src/main.ts')
      expect(patch).toContain('+++ b/src/main.ts')
      expect(patch).toContain('@@ -1,3 +1,3 @@')
      expect(patch).toContain('-  return 0')
      expect(patch).toContain('+  return process.exit(0)')
    })
  })

  describe('Review endpoint', () => {
    test('should post review successfully', async () => {
      const response = await fetch(
        'https://gerrit.example.com/a/changes/12345/revisions/current/review',
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa('user:pass')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'Test review',
          }),
        },
      )

      expect(response.status).toBe(200)
      const text = await response.text()
      const result = JSON.parse(text.substring(5))

      expect(result).toHaveProperty('labels')
      expect(result).toHaveProperty('ready')
      expect(result.ready).toBe(true)
    })
  })

  describe('Default behavior', () => {
    test('should return 404 for unhandled endpoints', async () => {
      const response = await fetch('https://gerrit.example.com/a/unknown/endpoint', {
        headers: {
          Authorization: `Basic ${btoa('user:pass')}`,
        },
      })

      expect(response.status).toBe(404)
      const text = await response.text()
      expect(text).toContain('Not found')
    })

    test('should handle non-GET/POST methods', async () => {
      const response = await fetch('https://gerrit.example.com/a/changes/12345', {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${btoa('user:pass')}`,
        },
      })

      expect(response.status).toBe(404)
    })
  })

  describe('URL handling', () => {
    test('should handle URL objects', async () => {
      const url = new URL('https://gerrit.example.com/a/changes/12345')
      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${btoa('user:pass')}`,
        },
      })

      expect(response.status).toBe(200)
    })

    test('should handle query parameters in URLs', async () => {
      const response = await fetch('https://gerrit.example.com/a/changes/?q=status:open&n=25', {
        headers: {
          Authorization: `Basic ${btoa('user:pass')}`,
        },
      })

      expect(response.status).toBe(200)
    })
  })

  describe('Edge cases', () => {
    test('should handle empty headers object', async () => {
      const response = await fetch('https://gerrit.example.com/a/changes/12345', {
        headers: {},
      })

      expect(response.status).toBe(401)
    })

    test('should handle missing options', async () => {
      const response = await fetch('https://gerrit.example.com/a/changes/12345')

      expect(response.status).toBe(401)
    })

    test('should handle complex file paths with special characters', async () => {
      const response = await fetch(
        'https://gerrit.example.com/a/changes/12345/revisions/current/files/src%2Futils%2Fhelpers.ts/diff',
        {
          headers: {
            Authorization: `Basic ${btoa('user:pass')}`,
          },
        },
      )

      expect(response.status).toBe(200)
    })
  })
})
