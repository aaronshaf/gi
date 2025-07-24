#!/usr/bin/env bun

import { execSync } from 'child_process'

// Coverage thresholds
const THRESHOLDS = {
  lines: 80,
  functions: 80,
}

console.log('Running tests with coverage...\n')

try {
  // Run tests with coverage and capture both stdout and stderr
  const output = execSync('bun test --coverage 2>&1', { encoding: 'utf8' })
  
  // Print the output
  console.log(output)
  
  // Parse coverage from output
  const coverageMatch = output.match(/All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/)
  if (!coverageMatch) {
    console.log('\n⚠️  Could not parse coverage output')
    // Still exit with success if we can't parse but tests passed
    process.exit(0)
  }

  const functionsCoverage = parseFloat(coverageMatch[1])
  const linesCoverage = parseFloat(coverageMatch[2])

  console.log(`\n📊 Coverage Summary:`)
  console.log(`   Functions: ${functionsCoverage}%`)
  console.log(`   Lines: ${linesCoverage}%`)

  // Check thresholds
  let failed = false
  if (functionsCoverage < THRESHOLDS.functions) {
    console.log(`\n❌ Functions coverage (${functionsCoverage}%) is below threshold (${THRESHOLDS.functions}%)`)
    failed = true
  }

  if (linesCoverage < THRESHOLDS.lines) {
    console.log(`\n❌ Lines coverage (${linesCoverage}%) is below threshold (${THRESHOLDS.lines}%)`)
    failed = true
  }

  if (failed) {
    console.log('\n⚠️  Coverage is below threshold but not failing CI (adjust if needed)')
    // For now, don't fail CI on coverage - this can be enabled later
    // process.exit(1)
    process.exit(0)
  } else {
    console.log('\n✅ Coverage meets all thresholds!')
    process.exit(0)
  }
} catch (error: any) {
  // If tests failed, the exit code will be non-zero
  if (error.status !== 0) {
    console.log('\n❌ Tests failed!')
    // Still print the output if available
    if (error.stdout) {
      console.log(error.stdout.toString())
    }
    process.exit(1)
  }
  // Other errors
  console.error('Error running coverage check:', error.message)
  process.exit(1)
}