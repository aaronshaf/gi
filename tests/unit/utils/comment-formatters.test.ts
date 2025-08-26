import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test'
import {
  formatCommentsPretty,
  formatCommentsXml,
  CommentWithContext,
} from '@/utils/comment-formatters'
import type { CommentInfo } from '@/schemas/gerrit'

describe('Comment Formatters', () => {
  const mockComment: CommentInfo = {
    id: 'comment1',
    path: 'src/main.ts',
    author: {
      _account_id: 1000123,
      name: 'John Doe',
      email: 'john.doe@example.com',
    },
    updated: '2023-12-01 12:30:00.000000000',
    message: 'This looks good to me!',
  }

  const mockLineComment: CommentInfo = {
    ...mockComment,
    id: 'linecomment1',
    line: 42,
    range: {
      start_line: 42,
      start_character: 0,
      end_line: 42,
      end_character: 20,
    },
    message: 'Consider using a more descriptive variable name.',
  }

  describe('formatCommentsPretty', () => {
    // Mock console.log to capture output
    const originalConsoleLog = console.log
    let consoleOutput: string[] = []

    beforeEach(() => {
      consoleOutput = []
      console.log = mock((...args: any[]) => {
        consoleOutput.push(args.join(' '))
      })
    })

    afterEach(() => {
      console.log = originalConsoleLog
    })

    test('should handle empty comments array', () => {
      formatCommentsPretty([])

      expect(consoleOutput).toContain('No comments found on this change')
    })

    test('should format single comment', () => {
      const commentWithContext: CommentWithContext = {
        comment: mockComment,
      }

      formatCommentsPretty([commentWithContext])

      const output = consoleOutput.join('\n')
      expect(output).toContain('Found 1 comment:')
      expect(output).toContain('John Doe')
      expect(output).toContain('This looks good to me!')
      expect(output).toContain('src/main.ts')
    })

    test('should format multiple comments', () => {
      const comments: CommentWithContext[] = [
        { comment: mockComment },
        { comment: { ...mockComment, id: 'comment2', message: 'Another comment' } },
      ]

      formatCommentsPretty(comments)

      const output = consoleOutput.join('\n')
      expect(output).toContain('Found 2 comments:')
      expect(output).toContain('This looks good to me!')
      expect(output).toContain('Another comment')
    })

    test('should show line information for line comments', () => {
      const commentWithContext: CommentWithContext = {
        comment: mockLineComment,
      }

      formatCommentsPretty([commentWithContext])

      const output = consoleOutput.join('\n')
      expect(output).toContain('Line 42:')
    })

    test('should show diff context when available', () => {
      const commentWithContext: CommentWithContext = {
        comment: mockLineComment,
        context: {
          before: ['  const oldValue = getValue();'],
          line: '  const newValue = getBetterValue();',
          after: ['  return newValue;'],
        },
      }

      formatCommentsPretty([commentWithContext])

      const output = consoleOutput.join('\n')
      expect(output).toContain('const oldValue')
      expect(output).toContain('const newValue')
      expect(output).toContain('return newValue')
    })

    test('should handle unresolved comments', () => {
      const unresolvedComment: CommentWithContext = {
        comment: {
          ...mockComment,
          unresolved: true,
        },
      }

      formatCommentsPretty([unresolvedComment])

      const output = consoleOutput.join('\n')
      expect(output).toContain('[UNRESOLVED]')
    })

    test('should handle comments without author name', () => {
      const commentWithoutName: CommentWithContext = {
        comment: {
          ...mockComment,
          author: {
            _account_id: 1000123,
            email: 'anonymous@example.com',
          },
        },
      }

      formatCommentsPretty([commentWithoutName])

      const output = consoleOutput.join('\n')
      expect(output).toContain('Unknown')
    })

    test('should handle multiline messages', () => {
      const multilineComment: CommentWithContext = {
        comment: {
          ...mockComment,
          message: 'This is line 1\nThis is line 2\nThis is line 3',
        },
      }

      formatCommentsPretty([multilineComment])

      const output = consoleOutput.join('\n')
      expect(output).toContain('This is line 1')
      expect(output).toContain('This is line 2')
      expect(output).toContain('This is line 3')
    })

    test('should group comments by file path', () => {
      const comments: CommentWithContext[] = [
        { comment: { ...mockComment, path: 'src/file1.ts' } },
        { comment: { ...mockComment, path: 'src/file1.ts', id: 'comment2' } },
        { comment: { ...mockComment, path: 'src/file2.ts', id: 'comment3' } },
      ]

      formatCommentsPretty(comments)

      const output = consoleOutput.join('\n')
      expect(output).toContain('src/file1.ts')
      expect(output).toContain('src/file2.ts')
    })

    test('should handle context with only before lines', () => {
      const commentWithContext: CommentWithContext = {
        comment: mockLineComment,
        context: {
          before: ['  // Previous line 1', '  // Previous line 2'],
          after: [],
        },
      }

      formatCommentsPretty([commentWithContext])

      const output = consoleOutput.join('\n')
      expect(output).toContain('Previous line 1')
      expect(output).toContain('Previous line 2')
    })

    test('should handle context with only after lines', () => {
      const commentWithContext: CommentWithContext = {
        comment: mockLineComment,
        context: {
          before: [],
          after: ['  // Next line 1', '  // Next line 2'],
        },
      }

      formatCommentsPretty([commentWithContext])

      const output = consoleOutput.join('\n')
      expect(output).toContain('Next line 1')
      expect(output).toContain('Next line 2')
    })
  })

  describe('formatCommentsXml', () => {
    const originalConsoleLog = console.log
    let consoleOutput: string[] = []

    beforeEach(() => {
      consoleOutput = []
      console.log = mock((...args: any[]) => {
        consoleOutput.push(args.join(' '))
      })
    })

    afterEach(() => {
      console.log = originalConsoleLog
    })

    test('should format basic XML structure', () => {
      const commentWithContext: CommentWithContext = {
        comment: mockComment,
      }

      formatCommentsXml('12345', [commentWithContext])

      const output = consoleOutput.join('\n')
      expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(output).toContain('<comments_result>')
      expect(output).toContain('<change_id>12345</change_id>')
      expect(output).toContain('<comment_count>1</comment_count>')
      expect(output).toContain('<comments>')
      expect(output).toContain('</comments_result>')
    })

    test('should format comment details in XML', () => {
      const commentWithContext: CommentWithContext = {
        comment: mockLineComment,
      }

      formatCommentsXml('12345', [commentWithContext])

      const output = consoleOutput.join('\n')
      expect(output).toContain('<id>linecomment1</id>')
      expect(output).toContain('<path><![CDATA[src/main.ts]]></path>')
      expect(output).toContain('<line>42</line>')
      expect(output).toContain('<name><![CDATA[John Doe]]></name>')
      expect(output).toContain('<email>john.doe@example.com</email>')
      expect(output).toContain('<account_id>1000123</account_id>')
      expect(output).toContain('<updated>2023-12-01 12:30:00.000000000</updated>')
      expect(output).toContain(
        '<message><![CDATA[Consider using a more descriptive variable name.]]></message>',
      )
    })

    test('should format range information in XML', () => {
      const commentWithRange: CommentWithContext = {
        comment: {
          ...mockLineComment,
          range: {
            start_line: 42,
            start_character: 5,
            end_line: 44,
            end_character: 15,
          },
        },
      }

      formatCommentsXml('12345', [commentWithRange])

      const output = consoleOutput.join('\n')
      expect(output).toContain('<range>')
      expect(output).toContain('<start_line>42</start_line>')
      expect(output).toContain('<start_character>5</start_character>')
      expect(output).toContain('<end_line>44</end_line>')
      expect(output).toContain('<end_character>15</end_character>')
      expect(output).toContain('</range>')
    })

    test('should format diff context in XML', () => {
      const commentWithContext: CommentWithContext = {
        comment: mockComment,
        context: {
          before: ['  const oldCode = getValue();'],
          line: '  const newCode = getBetterValue();',
          after: ['  return newCode;'],
        },
      }

      formatCommentsXml('12345', [commentWithContext])

      const output = consoleOutput.join('\n')
      expect(output).toContain('<diff_context>')
      expect(output).toContain('<before>')
      expect(output).toContain('<![CDATA[  const oldCode = getValue();]]>')
      expect(output).toContain(
        '<target_line><![CDATA[  const newCode = getBetterValue();]]></target_line>',
      )
      expect(output).toContain('<after>')
      expect(output).toContain('<![CDATA[  return newCode;]]>')
      expect(output).toContain('</diff_context>')
    })

    test('should handle unresolved comments in XML', () => {
      const unresolvedComment: CommentWithContext = {
        comment: {
          ...mockComment,
          unresolved: true,
        },
      }

      formatCommentsXml('12345', [unresolvedComment])

      const output = consoleOutput.join('\n')
      expect(output).toContain('<unresolved>true</unresolved>')
    })

    test('should handle in_reply_to in XML', () => {
      const replyComment: CommentWithContext = {
        comment: {
          ...mockComment,
          in_reply_to: 'parent_comment_id',
        },
      }

      formatCommentsXml('12345', [replyComment])

      const output = consoleOutput.join('\n')
      expect(output).toContain('<in_reply_to>parent_comment_id</in_reply_to>')
    })

    test('should escape special characters in change ID', () => {
      const commentWithContext: CommentWithContext = {
        comment: mockComment,
      }

      formatCommentsXml('project~main~I123&<>', [commentWithContext])

      const output = consoleOutput.join('\n')
      expect(output).toContain('<change_id>project~main~I123&amp;&lt;&gt;</change_id>')
    })

    test('should handle comments without optional fields', () => {
      const minimalComment: CommentWithContext = {
        comment: {
          id: 'minimal',
          author: {
            _account_id: 1000123,
          },
          updated: '2023-12-01 12:30:00.000000000',
          message: 'Minimal comment',
        },
      }

      formatCommentsXml('12345', [minimalComment])

      const output = consoleOutput.join('\n')
      expect(output).toContain('<id>minimal</id>')
      expect(output).toContain('<account_id>1000123</account_id>')
      expect(output).toContain('<message><![CDATA[Minimal comment]]></message>')
      expect(output).not.toContain('<path>')
      expect(output).not.toContain('<line>')
      expect(output).not.toContain('<name>')
      expect(output).not.toContain('<email>')
    })

    test('should handle range without optional character positions', () => {
      const commentWithBasicRange: CommentWithContext = {
        comment: {
          ...mockLineComment,
          range: {
            start_line: 42,
            end_line: 44,
          },
        },
      }

      formatCommentsXml('12345', [commentWithBasicRange])

      const output = consoleOutput.join('\n')
      expect(output).toContain('<start_line>42</start_line>')
      expect(output).toContain('<end_line>44</end_line>')
      expect(output).not.toContain('<start_character>')
      expect(output).not.toContain('<end_character>')
    })

    test('should handle multiple comments correctly', () => {
      const comments: CommentWithContext[] = [
        { comment: mockComment },
        { comment: { ...mockComment, id: 'comment2', message: 'Second comment' } },
      ]

      formatCommentsXml('12345', comments)

      const output = consoleOutput.join('\n')
      expect(output).toContain('<comment_count>2</comment_count>')
      expect(output).toContain('<id>comment1</id>')
      expect(output).toContain('<id>comment2</id>')
      expect(output).toContain('This looks good to me!')
      expect(output).toContain('Second comment')
    })

    test('should handle empty comments array', () => {
      formatCommentsXml('12345', [])

      const output = consoleOutput.join('\n')
      expect(output).toContain('<comment_count>0</comment_count>')
      expect(output).toContain('<comments>')
      expect(output).toContain('</comments>')
    })
  })
})
