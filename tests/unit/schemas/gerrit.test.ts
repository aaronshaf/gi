import { describe, expect, test } from 'bun:test'
import { Schema } from '@effect/schema'
import { CommentInput, GerritCredentials } from '@/schemas/gerrit'

describe('Gerrit Schemas', () => {
  describe('GerritCredentials', () => {
    test('should validate valid credentials', () => {
      const validCredentials = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
      }

      const result = Schema.decodeUnknownSync(GerritCredentials)(validCredentials)
      expect(result).toEqual(validCredentials)
    })

    test('should reject invalid URL', () => {
      const invalidCredentials = {
        host: 'not-a-url',
        username: 'testuser',
        password: 'testpass123',
      }

      expect(() => {
        Schema.decodeUnknownSync(GerritCredentials)(invalidCredentials)
      }).toThrow()
    })

    test('should reject empty username', () => {
      const invalidCredentials = {
        host: 'https://gerrit.example.com',
        username: '',
        password: 'testpass123',
      }

      expect(() => {
        Schema.decodeUnknownSync(GerritCredentials)(invalidCredentials)
      }).toThrow()
    })

    test('should reject empty password', () => {
      const invalidCredentials = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: '',
      }

      expect(() => {
        Schema.decodeUnknownSync(GerritCredentials)(invalidCredentials)
      }).toThrow()
    })
  })

  describe('CommentInput', () => {
    test('should validate valid comment input', () => {
      const validComment = {
        message: 'This is a test comment',
        unresolved: true,
      }

      const result = Schema.decodeUnknownSync(CommentInput)(validComment)
      expect(result).toEqual(validComment)
    })

    test('should validate comment without unresolved flag', () => {
      const validComment = {
        message: 'This is a test comment',
      }

      const result = Schema.decodeUnknownSync(CommentInput)(validComment)
      expect(result).toEqual(validComment)
    })

    test('should reject empty message', () => {
      const invalidComment = {
        message: '',
      }

      expect(() => {
        Schema.decodeUnknownSync(CommentInput)(invalidComment)
      }).toThrow()
    })
  })
})
