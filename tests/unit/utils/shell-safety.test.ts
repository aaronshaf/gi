import { test, expect, describe } from 'bun:test'
import { Effect } from 'effect'
import { sanitizeUrl, sanitizeUrlSync, getOpenCommand } from '@/utils/shell-safety'

describe('Shell Safety Utilities', () => {
  describe('sanitizeUrl (Effect-based)', () => {
    test('should accept valid HTTPS URLs', async () => {
      const url = 'https://gerrit.example.com/c/project/+/12345'
      const result = await Effect.runPromise(sanitizeUrl(url).pipe(Effect.either))

      expect(result._tag).toBe('Right')
      if (result._tag === 'Right') {
        expect(result.right).toBe(url)
      }
    })

    test('should reject HTTP URLs', async () => {
      const url = 'http://gerrit.example.com/c/project/+/12345'
      const result = await Effect.runPromise(sanitizeUrl(url).pipe(Effect.either))

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left.message).toContain('Invalid protocol')
      }
    })

    test('should reject URLs with dangerous characters', async () => {
      const dangerousUrls = [
        'https://gerrit.example.com/c/project/+/12345;rm -rf /',
        'https://gerrit.example.com/c/project/+/12345`whoami`',
        'https://gerrit.example.com/c/project/+/12345$(whoami)',
        'https://gerrit.example.com/c/project/+/12345|ls',
        'https://gerrit.example.com/c/project/+/12345&sleep 10',
      ]

      for (const url of dangerousUrls) {
        const result = await Effect.runPromise(sanitizeUrl(url).pipe(Effect.either))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left.message).toContain('dangerous characters')
        }
      }
    })

    test('should reject malformed URLs', async () => {
      const invalidUrls = ['not-a-url', 'https://', 'https:///', '', 'ftp://example.com']

      for (const url of invalidUrls) {
        const result = await Effect.runPromise(sanitizeUrl(url).pipe(Effect.either))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left.message).toContain('Invalid')
        }
      }
    })

    test('should accept complex but safe URLs', async () => {
      const safeUrls = [
        'https://gerrit.example.com/c/project/+/12345',
        'https://gerrit.example.com/c/my-project/+/12345/1',
        'https://gerrit.example.com:8080/c/project/+/12345',
        'https://gerrit-review.example.com/c/project-name/+/12345',
      ]

      for (const url of safeUrls) {
        const result = await Effect.runPromise(sanitizeUrl(url).pipe(Effect.either))
        expect(result._tag).toBe('Right')
        if (result._tag === 'Right') {
          expect(result.right).toBe(url)
        }
      }
    })
  })

  describe('sanitizeUrlSync (synchronous)', () => {
    test('should accept valid HTTPS URLs', () => {
      const url = 'https://gerrit.example.com/c/project/+/12345'
      expect(() => sanitizeUrlSync(url)).not.toThrow()
      expect(sanitizeUrlSync(url)).toBe(url)
    })

    test('should reject HTTP URLs', () => {
      const url = 'http://gerrit.example.com/c/project/+/12345'
      expect(() => sanitizeUrlSync(url)).toThrow('Invalid protocol')
    })

    test('should reject URLs with dangerous characters', () => {
      const url = 'https://gerrit.example.com/c/project/+/12345;rm -rf /'
      expect(() => sanitizeUrlSync(url)).toThrow('dangerous characters')
    })

    test('should reject malformed URLs', () => {
      const url = 'not-a-url'
      expect(() => sanitizeUrlSync(url)).toThrow('Invalid URL format')
    })
  })

  describe('getOpenCommand', () => {
    test('should return correct command for each platform', () => {
      const originalPlatform = process.platform

      // Test macOS
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      expect(getOpenCommand()).toBe('open')

      // Test Windows
      Object.defineProperty(process, 'platform', { value: 'win32' })
      expect(getOpenCommand()).toBe('start')

      // Test Linux
      Object.defineProperty(process, 'platform', { value: 'linux' })
      expect(getOpenCommand()).toBe('xdg-open')

      // Test other Unix-like systems
      Object.defineProperty(process, 'platform', { value: 'freebsd' })
      expect(getOpenCommand()).toBe('xdg-open')

      // Restore original platform
      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })
  })

  describe('URL edge cases', () => {
    test('should handle URLs with ports', () => {
      const url = 'https://gerrit.example.com:8080/c/project/+/12345'
      expect(() => sanitizeUrlSync(url)).not.toThrow()
      expect(sanitizeUrlSync(url)).toBe(url)
    })

    test('should handle URLs with query parameters', () => {
      const url = 'https://gerrit.example.com/c/project/+/12345?tab=comments'
      expect(() => sanitizeUrlSync(url)).not.toThrow()
      expect(sanitizeUrlSync(url)).toBe(url)
    })

    test('should handle URLs with fragments', () => {
      const url = 'https://gerrit.example.com/c/project/+/12345#message-abc123'
      expect(() => sanitizeUrlSync(url)).not.toThrow()
      expect(sanitizeUrlSync(url)).toBe(url)
    })

    test('should reject URLs with empty hostnames', () => {
      // Note: new URL('https:///path') actually creates a valid URL object with hostname 'c'
      // So let's test with a truly malformed URL
      expect(() => sanitizeUrlSync('https:///')).toThrow('Invalid URL format')
    })
  })
})
