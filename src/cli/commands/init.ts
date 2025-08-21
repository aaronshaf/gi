import { Effect } from 'effect'
import { ConfigService } from '@/services/config'
import type { GerritCredentials } from '@/schemas/gerrit'

export const initCommand = () =>
  Effect.gen(function* () {
    const configService = yield* ConfigService
    
    // For simplicity, we'll use environment variables or command-line input
    console.log('Gerrit CLI Setup')
    console.log('================')
    console.log('')
    console.log('Please set the following environment variables:')
    console.log('  GERRIT_HOST - Your Gerrit server URL (e.g., https://gerrit.example.com)')
    console.log('  GERRIT_USERNAME - Your Gerrit username')
    console.log('  GERRIT_PASSWORD - Your Gerrit HTTP password')
    console.log('')
    
    const host = process.env.GERRIT_HOST
    const username = process.env.GERRIT_USERNAME
    const password = process.env.GERRIT_PASSWORD
    
    if (!host || !username || !password) {
      yield* Effect.fail(new Error('Missing required environment variables'))
    }
    
    const credentials: GerritCredentials = {
      host: host!,
      username: username!,
      password: password!,
    }
    
    yield* configService.saveCredentials(credentials)
    
    console.log('✓ Credentials saved successfully!')
    console.log('You can now use other commands like:')
    console.log('  ger status')
    console.log('  ger comment <change-id> -m "message"')
  })
