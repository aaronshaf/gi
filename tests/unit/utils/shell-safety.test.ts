import { test, expect, describe } from 'bun:test'
import { Effect } from 'effect'
import {
  sanitizeUrl,
  sanitizeUrlSync,
  getOpenCommand,
  sanitizeCDATA,
  escapeXML,
} from '@/utils/shell-safety'

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

  describe('sanitizeCDATA', () => {
    test('should handle normal text content', () => {
      const input = 'This is normal text content\nwith multiple lines'
      expect(sanitizeCDATA(input)).toBe(input)
    })

    test('should escape CDATA end sequences', () => {
      const input = 'Some content with ]]> dangerous sequence'
      const expected = 'Some content with ]]&gt; dangerous sequence'
      expect(sanitizeCDATA(input)).toBe(expected)
    })

    test('should remove null bytes', () => {
      const input = 'Content with\x00null bytes'
      const expected = 'Content withnull bytes'
      expect(sanitizeCDATA(input)).toBe(expected)
    })

    test('should remove control characters but keep allowed ones', () => {
      const input = 'Content\twith\ntab\rand\x08backspace\x1fcontrol'
      const expected = 'Content\twith\ntab\randbackspacecontrol'
      expect(sanitizeCDATA(input)).toBe(expected)
    })

    test('should handle empty string', () => {
      expect(sanitizeCDATA('')).toBe('')
    })

    test('should throw error for non-string input', () => {
      expect(() => sanitizeCDATA(123 as never)).toThrow('Content must be a string')
      expect(() => sanitizeCDATA(null as never)).toThrow('Content must be a string')
      expect(() => sanitizeCDATA(undefined as never)).toThrow('Content must be a string')
    })

    test('should handle complex CDATA injection attempts', () => {
      const input = 'Normal content]]><script>alert("xss")</script><![CDATA[more content'
      const expected = 'Normal content]]&gt;<script>alert("xss")</script><![CDATA[more content'
      expect(sanitizeCDATA(input)).toBe(expected)
    })
  })

  describe('escapeXML', () => {
    test('should escape all XML special characters', () => {
      const input = 'Text with & < > " \' characters'
      const expected = 'Text with &amp; &lt; &gt; &quot; &apos; characters'
      expect(escapeXML(input)).toBe(expected)
    })

    test('should handle normal text without special characters', () => {
      const input = 'Normal text content'
      expect(escapeXML(input)).toBe(input)
    })

    test('should handle empty string', () => {
      expect(escapeXML('')).toBe('')
    })

    test('should throw error for non-string input', () => {
      expect(() => escapeXML(123 as never)).toThrow('Content must be a string')
      expect(() => escapeXML(null as never)).toThrow('Content must be a string')
      expect(() => escapeXML(undefined as never)).toThrow('Content must be a string')
    })

    test('should handle complex XML injection attempts', () => {
      const input = '<script src="evil.js"></script>&malicious;'
      const expected = '&lt;script src=&quot;evil.js&quot;&gt;&lt;/script&gt;&amp;malicious;'
      expect(escapeXML(input)).toBe(expected)
    })

    test('should handle ampersand properly', () => {
      const input = 'AT&T & Johnson & Johnson'
      const expected = 'AT&amp;T &amp; Johnson &amp; Johnson'
      expect(escapeXML(input)).toBe(expected)
    })
  })
})
