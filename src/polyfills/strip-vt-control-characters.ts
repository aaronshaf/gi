// Polyfill for stripVTControlCharacters which is not available in Bun yet
// This function is available in Node.js 21.7.0+ but not in Bun
import * as util from 'node:util'

// Check if the function already exists
if (!('stripVTControlCharacters' in util)) {
  // Add the polyfill
  // Based on the Node.js implementation and strip-ansi library
  const ansiRegex = () => {
    const pattern = [
      '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
      '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
    ].join('|')

    return new RegExp(pattern, 'g')
  }

  // @ts-ignore - Adding to util module
  util.stripVTControlCharacters = (str: string): string => {
    if (typeof str !== 'string') {
      throw new TypeError(`Expected a string, got ${typeof str}`)
    }
    return str.replace(ansiRegex(), '')
  }
}

export {}
