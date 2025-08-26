import { Effect } from 'effect'

/**
 * Safely sanitizes URLs to prevent shell injection attacks
 * Only allows HTTPS URLs with valid characters
 */
export const sanitizeUrl = (url: string): Effect.Effect<string, Error> =>
  Effect.try({
    try: () => {
      const parsed = new URL(url)

      // Only allow https protocol
      if (parsed.protocol !== 'https:') {
        throw new Error(`Invalid protocol: ${parsed.protocol}. Only HTTPS is allowed.`)
      }

      // Check for suspicious characters that could be shell injection
      const dangerousChars = /[;&|`$(){}[\]\\'"<>]/
      if (dangerousChars.test(url)) {
        throw new Error('URL contains potentially dangerous characters')
      }

      // Validate hostname format
      if (!parsed.hostname || parsed.hostname.length === 0) {
        throw new Error('Invalid hostname')
      }

      // Return the sanitized URL
      return parsed.toString()
    },
    catch: (error) =>
      new Error(`Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`),
  })

/**
 * Synchronous URL sanitization for non-Effect contexts
 * Throws error if URL is invalid or unsafe
 */
export const sanitizeUrlSync = (url: string): string => {
  try {
    const parsed = new URL(url)

    // Only allow https protocol
    if (parsed.protocol !== 'https:') {
      throw new Error(`Invalid protocol: ${parsed.protocol}. Only HTTPS is allowed.`)
    }

    // Check for suspicious characters that could be shell injection
    const dangerousChars = /[;&|`$(){}[\]\\'"<>]/
    if (dangerousChars.test(url)) {
      throw new Error('URL contains potentially dangerous characters')
    }

    // Validate hostname format
    if (!parsed.hostname || parsed.hostname.length === 0) {
      throw new Error('Invalid hostname')
    }

    return parsed.toString()
  } catch (error) {
    throw new Error(
      `Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

/**
 * Gets the appropriate command to open URLs based on platform
 */
export const getOpenCommand = (): string => {
  switch (process.platform) {
    case 'darwin':
      return 'open'
    case 'win32':
      return 'start'
    default:
      return 'xdg-open'
  }
}

/**
 * Safely sanitizes content for inclusion in XML CDATA sections
 * Prevents XXE attacks and CDATA injection
 */
export const sanitizeCDATA = (content: string): string => {
  if (typeof content !== 'string') {
    throw new Error('Content must be a string')
  }

  // Replace CDATA end sequences to prevent CDATA injection
  let sanitized = content.replace(/]]>/g, ']]&gt;')

  // Replace null bytes which can cause issues in XML processing
  sanitized = sanitized.replace(/\0/g, '')

  // Replace control characters except for allowed ones (tab \x09, newline \x0A, carriage return \x0D)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  return sanitized
}

/**
 * Safely escapes content for XML element values
 * Escapes XML special characters
 */
export const escapeXML = (content: string): string => {
  if (typeof content !== 'string') {
    throw new Error('Content must be a string')
  }

  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
