import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as readline from 'node:readline/promises'
import { Effect } from 'effect'
import type { GerritCredentials } from '@/schemas/gerrit'
import { ConfigService } from '@/services/config'

const CONFIG_FILE = path.join(os.homedir(), '.ger', 'auth.json')

const obscureToken = (token: string): string => {
  if (token.length <= 8) return '****'
  return `${token.substring(0, 4)}****${token.substring(token.length - 4)}`
}

// Hidden password input using manual stdin manipulation
const readPassword = async (prompt: string, fallbackPrompt?: string): Promise<string> => {
  const stdin = process.stdin
  const stdout = process.stdout

  // Check if we can use raw mode (TTY environment)
  if (!stdin.isTTY || !stdin.setRawMode) {
    // Fallback to regular readline with warning
    if (fallbackPrompt) {
      console.log('⚠️  Note: Password will be visible while typing (non-TTY environment)')
    }
    const rl = readline.createInterface({
      input: stdin,
      output: stdout,
    })
    const answer = await rl.question(fallbackPrompt || prompt)
    rl.close()
    return answer
  }

  return new Promise((resolve) => {
    stdout.write(prompt)

    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')

    let password = ''

    const onData = (char: string) => {
      const code = char.charCodeAt(0)

      if (code === 3) {
        // Ctrl+C
        stdout.write('\n')
        process.exit(0)
      } else if (code === 13 || code === 10) {
        // Enter
        stdin.setRawMode(false)
        stdin.pause()
        stdin.removeListener('data', onData)
        stdout.write('\n')
        resolve(password)
      } else if (code === 127 || code === 8) {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1)
          stdout.write('\b \b') // Move back, write space, move back again
        }
      } else if (code >= 32 && code <= 126) {
        // Printable characters
        password += char
        stdout.write('*')
      }
    }

    stdin.on('data', onData)
  })
}

const readExistingConfig = (): GerritCredentials | null => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf8')
      return JSON.parse(content)
    }
  } catch {
    // Ignore errors
  }
  return null
}

export const initCommand = (): Effect.Effect<void, Error, ConfigService> =>
  Effect.gen(function* () {
    const configService = yield* ConfigService

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    console.log('Gerrit CLI Setup')
    console.log('================')
    console.log('')

    // Load existing config if it exists
    const existing = readExistingConfig()

    if (existing) {
      console.log('Found existing configuration:')
      console.log(`  Host: ${existing.host}`)
      console.log(`  Username: ${existing.username}`)
      console.log(`  Password: ${obscureToken(existing.password)}`)
      console.log('')
      console.log('Press Enter to keep existing values, or type new ones.')
      console.log('')
    }

    // Prompt for host
    const hostPrompt = existing?.host
      ? `Gerrit host [${existing.host}]: `
      : 'Gerrit host (e.g., https://gerrit.example.com): '
    const host = yield* Effect.tryPromise(() => rl.question(hostPrompt)).pipe(
      Effect.map((answer) => answer || existing?.host),
      Effect.flatMap((value) =>
        value ? Effect.succeed(value) : Effect.fail(new Error('Host is required')),
      ),
    )

    // Prompt for username
    const usernamePrompt = existing?.username ? `Username [${existing.username}]: ` : 'Username: '
    const username = yield* Effect.tryPromise(() => rl.question(usernamePrompt)).pipe(
      Effect.map((answer) => answer || existing?.username),
      Effect.flatMap((value) =>
        value ? Effect.succeed(value) : Effect.fail(new Error('Username is required')),
      ),
    )

    // Close readline interface before password prompt (we'll use raw mode)
    rl.close()

    // Prompt for password (with hidden input)
    const passwordPrompt = existing?.password
      ? `HTTP Password [${obscureToken(existing.password)}]: `
      : 'HTTP Password (from Gerrit Settings → HTTP Password): '

    const password = yield* Effect.tryPromise(() => readPassword(passwordPrompt)).pipe(
      Effect.map((answer) => answer || existing?.password),
      Effect.flatMap((value) =>
        value ? Effect.succeed(value) : Effect.fail(new Error('Password is required')),
      ),
    )

    const credentials: GerritCredentials = {
      host: host.replace(/\/$/, ''), // Remove trailing slash if present
      username,
      password,
    }

    yield* configService.saveCredentials(credentials)

    console.log('')
    console.log('✓ Credentials saved to ~/.ger/auth.json')
    console.log('')
    console.log('You can now use commands like:')
    console.log('  ger status')
    console.log('  ger mine --pretty')
    console.log('  ger workspace <change-id>')
  })
