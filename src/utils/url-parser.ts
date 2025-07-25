/**
 * Utility functions for parsing Gerrit URLs and extracting change numbers
 */

/**
 * Extracts a change number from various Gerrit URL formats
 * 
 * Supported formats:
 * - https://gerrit.example.com/c/project-name/+/123456
 * - https://gerrit.example.com/c/project-name/+/123456/
 * - https://gerrit.example.com/c/project-name/+/123456/1
 * - https://gerrit.example.com/#/c/project-name/+/123456/
 * - 123456 (plain change number - returned as-is)
 * 
 * @param input - The input string (URL or change number)
 * @returns The extracted change number as a string, or the original input if not a URL
 */
export const extractChangeNumber = (input: string): string => {
  const trimmed = input.trim()
  
  // If it's already just a number or change ID (like "123456" or "Iabcd1234..."), return as-is
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed
  }
  
  // Parse URL and extract change number
  try {
    const url = new URL(trimmed)
    
    // Match different Gerrit URL patterns
    // Pattern: /c/project-name/+/123456 or /#/c/project-name/+/123456
    const patterns = [
      /\/c\/[^/]+\/\+\/(\d+)/,           // /c/project/+/123456
      /#\/c\/[^/]+\/\+\/(\d+)/,         // /#/c/project/+/123456
      /\/c\/\+\/(\d+)/,                 // /c/+/123456 (simplified format)
      /#\/c\/\+\/(\d+)/,                // /#/c/+/123456 (simplified format)
    ]
    
    const fullPath = url.pathname + url.hash
    
    for (const pattern of patterns) {
      const match = fullPath.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }
    
    // If no pattern matches, return the original input
    return trimmed
  } catch {
    // If URL parsing fails, return the original input
    return trimmed
  }
}

/**
 * Validates if a string is a valid Gerrit change identifier
 * 
 * @param changeId - The change ID to validate
 * @returns true if it looks like a valid change ID
 */
export const isValidChangeId = (changeId: string): boolean => {
  const trimmed = changeId.trim()
  
  if (trimmed.length === 0) {
    return false
  }
  
  // Numeric change IDs (most common)
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10) > 0
  }
  
  // Change-Id format (starts with 'I' followed by exactly 40 hex characters)
  if (/^I[a-f0-9]{40}$/.test(trimmed)) {
    return true
  }
  
  // Reject strings with whitespace
  if (/\s/.test(trimmed)) {
    return false
  }
  
  // Reject negative numbers or other invalid formats
  if (trimmed.startsWith('-')) {
    return false
  }
  
  // Topic branches or other identifiers (at least 1 character, no whitespace)
  return trimmed.length > 0
}