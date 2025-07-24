import { describe, expect, test } from 'bun:test'
import {
  generateMockAccount,
  generateMockChange,
  generateMockFileDiff,
  generateMockFiles,
} from '@/test-utils/mock-generator'

describe('Mock Generator', () => {
  describe('generateMockChange', () => {
    test('should generate a complete mock change object', () => {
      const change = generateMockChange()

      expect(change).toMatchObject({
        id: 'myProject~master~I8473b95934b5732ac55d26311a706c9c2bde9940',
        project: 'myProject',
        branch: 'master',
        change_id: 'I8473b95934b5732ac55d26311a706c9c2bde9940',
        subject: 'Implementing new feature',
        status: 'NEW',
        created: '2023-12-01 10:00:00.000000000',
        updated: '2023-12-01 15:30:00.000000000',
        insertions: 25,
        deletions: 3,
        number: 12345,
        owner: {
          _account_id: 1000096,
          name: 'John Developer',
          email: 'john@example.com',
          username: 'jdeveloper',
        },
      })
    })

    test('should apply overrides to mock change', () => {
      const overrides = {
        subject: 'Custom subject',
        status: 'MERGED' as const,
        insertions: 100,
      }

      const change = generateMockChange(overrides)

      expect(change.subject).toBe('Custom subject')
      expect(change.status).toBe('MERGED')
      expect(change.insertions).toBe(100)
      // Original values should remain for non-overridden fields
      expect(change.project).toBe('myProject')
      expect(change.deletions).toBe(3)
    })

    test('should handle partial owner overrides', () => {
      const overrides = {
        owner: {
          _account_id: 999,
          name: 'Custom Developer',
          email: 'custom@example.com',
          username: 'customdev',
        },
      }

      const change = generateMockChange(overrides)

      expect(change.owner).toEqual(overrides.owner)
    })
  })

  describe('generateMockFiles', () => {
    test('should generate mock file info objects', () => {
      const files = generateMockFiles()

      expect(Object.keys(files)).toContain('src/main.ts')
      expect(Object.keys(files)).toContain('tests/main.test.ts')

      expect(files['src/main.ts']).toMatchObject({
        status: 'M',
        lines_inserted: 15,
        lines_deleted: 3,
        size_delta: 120,
        size: 1200,
      })

      expect(files['tests/main.test.ts']).toMatchObject({
        status: 'A',
        lines_inserted: 45,
        lines_deleted: 0,
        size_delta: 450,
        size: 450,
      })
    })

    test('should return consistent file structure', () => {
      const files1 = generateMockFiles()
      const files2 = generateMockFiles()

      expect(Object.keys(files1)).toEqual(Object.keys(files2))
      expect(files1['src/main.ts']).toEqual(files2['src/main.ts'])
    })
  })

  describe('generateMockFileDiff', () => {
    test('should generate mock file diff content', () => {
      const diff = generateMockFileDiff()

      expect(diff).toMatchObject({
        content: [
          {
            ab: ['function main() {', '  console.log("Hello, world!")'],
          },
          {
            a: ['  return 0'],
            b: ['  return process.exit(0)'],
          },
          {
            ab: ['}'],
          },
        ],
        change_type: 'MODIFIED',
        diff_header: ['--- a/src/main.ts', '+++ b/src/main.ts'],
      })
    })

    test('should have consistent structure', () => {
      const diff1 = generateMockFileDiff()
      const diff2 = generateMockFileDiff()

      expect(diff1.change_type).toBe('MODIFIED')
      expect(diff2.change_type).toBe('MODIFIED')
      expect(diff1.content.length).toBe(diff2.content.length)
      expect(diff1.diff_header).toEqual(['--- a/src/main.ts', '+++ b/src/main.ts'])
      expect(diff2.diff_header).toEqual(['--- a/src/main.ts', '+++ b/src/main.ts'])
    })
  })

  describe('generateMockAccount', () => {
    test('should generate mock account object', () => {
      const account = generateMockAccount()

      expect(account).toMatchObject({
        _account_id: 1000096,
        name: 'Test User',
        email: 'test@example.com',
        username: 'testuser',
      })
    })

    test('should return consistent account data', () => {
      const account1 = generateMockAccount()
      const account2 = generateMockAccount()

      expect(account1).toEqual(account2)
    })
  })
})