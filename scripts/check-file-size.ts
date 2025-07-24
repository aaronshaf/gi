#!/usr/bin/env bun

import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const MAX_LINES = 700
const WARN_LINES = 500

async function checkFileSize(dir: string): Promise<void> {
  const files = await readdir(dir, { withFileTypes: true })
  let hasErrors = false
  let hasWarnings = false

  for (const file of files) {
    const fullPath = join(dir, file.name)
    
    if (file.isDirectory() && !['node_modules', 'dist', 'tmp', '.git'].includes(file.name)) {
      await checkFileSize(fullPath)
    } else if (file.isFile() && file.name.endsWith('.ts')) {
      const content = await Bun.file(fullPath).text()
      const lines = content.split('\n').length
      
      if (lines > MAX_LINES) {
        console.error(`❌ ERROR: ${fullPath} has ${lines} lines (max: ${MAX_LINES})`)
        hasErrors = true
      } else if (lines > WARN_LINES) {
        console.warn(`⚠️  WARNING: ${fullPath} has ${lines} lines (recommended max: ${WARN_LINES})`)
        hasWarnings = true
      }
    }
  }

  if (hasErrors) {
    process.exit(1)
  }
}

checkFileSize('./src').catch(console.error)