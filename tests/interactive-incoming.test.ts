import { describe, expect, test } from 'bun:test'
import { incomingCommand } from '@/cli/commands/incoming'

describe('Interactive Incoming Command', () => {
  test('should create command with interactive option', () => {
    // Test that the command accepts the interactive option
    const command = incomingCommand({ interactive: true })
    expect(command).toBeDefined()
  })

  test('should create command with interactive and xml options', () => {
    // Test that the command accepts both options
    const command = incomingCommand({ interactive: true, xml: true })
    expect(command).toBeDefined()
  })

  test('should create command without interactive option', () => {
    // Test normal operation
    const command = incomingCommand({})
    expect(command).toBeDefined()
  })
})
