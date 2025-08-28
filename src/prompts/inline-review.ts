export const INLINE_REVIEW_PROMPT = `# Code Review Prompt for Inline Comments

Review this code change thoroughly. Do not modify any files or code.

Prioritize reviewing the code changes.
Do not treat previous comments as definitive. They could be wrong.

## CRITICAL: Context-Aware Analysis Requirements

Before generating inline comments, you MUST:
1. Read the COMPLETE files being modified (not just the diff)
2. Verify you're reviewing the LATEST patchset version
3. Check if issues are ALREADY FIXED elsewhere in the change
4. Understand the purpose and design of existing functions/classes
5. Consider how the code fits within the broader module/class
6. DO NOT comment on issues that are already resolved

## Analysis Scope
- Read full file context BEFORE commenting on changes
- Understand the author's intent from code comments and structure
- Check if apparent issues are handled elsewhere in the change
- Consider files changed, added, or deleted in full context
- Analyze interdependencies and side effects

## Priority Areas (descending importance)
1. **Critical Issues**
   - Logic errors and edge cases
   - Security vulnerabilities (injection, auth, data exposure)
   - Performance bottlenecks or resource leaks
   - Breaking changes to public APIs

2. **Code Quality**
   - Architecture and design patterns
   - Code clarity and maintainability
   - Error handling completeness
   - Resource management (connections, files, memory)

3. **Testing & Reliability**
   - Test coverage for new/changed functionality
   - Missing error scenarios in tests
   - Integration test considerations
   - Backward compatibility

4. **Standards & Best Practices**
   - Language-specific conventions
   - Framework usage patterns
   - Documentation accuracy
   - Dependency management

## Output Format
- Lead with critical issues requiring immediate attention
- Group related feedback logically
- Reference specific files/lines when relevant
- Be direct and actionable - explain why, not just what
- Prioritize signal over completeness
- Include 🤖 (with space) at beginning of each inline comment message
- Comments should be marked as resolved (omit "unresolved" field or set to false)
- CRITICAL: Never use backticks (\`) in messages - use quotes or plain text instead

## Constraints
- CRITICAL: Do NOT comment on issues already fixed in the current patchset
- Verify issues still exist before commenting
- No praise or positive commentary
- No trivial style issues unless they impact readability
- Focus on substantive technical concerns
- Assume the author knows their domain
- If uncertain about code purpose, phrase as a question
- Check if your concern is addressed elsewhere in the change

## CRITICAL OUTPUT REQUIREMENT

**YOUR ENTIRE OUTPUT MUST BE WRAPPED IN <response></response> TAGS.**
**NEVER USE BACKTICKS (\`) ANYWHERE IN YOUR RESPONSE - they cause shell execution errors.**

Output ONLY a JSON array wrapped in response tags. No other text before or after the tags.

## JSON Structure

The JSON array must contain inline comment objects. Each comment must include:
- \`file\`: Path to the file (required)
- \`message\`: Comment text starting with "🤖 " (required)
- Either \`line\` for single-line comments OR \`range\` for multi-line comments
- \`side\`: "REVISION" (default, for new code) or "PARENT" (for original code)

For multi-line issues, use range:
- \`range.start_line\`: Starting line number
- \`range.end_line\`: Ending line number
- \`range.start_character\`: Optional starting character position
- \`range.end_character\`: Optional ending character position

Line numbers refer to the final file (REVISION), not the diff.

## Example Output (THIS IS THE ONLY ACCEPTABLE FORMAT)
<response>
[
  {"file": "src/main.ts", "line": 10, "message": "🤖 Missing null check for user input - variable 'userData' can be undefined"},
  {"file": "src/utils.ts", "line": 25, "message": "🤖 Potential memory leak - event listener not removed in cleanup function"},
  {"file": "src/api.ts", "range": {"start_line": 50, "end_line": 65}, "message": "🤖 This error handling block could cause infinite retry loop when status is 429"}
]
</response>

## FINAL REMINDER
Remember: Your ENTIRE output must be a JSON array wrapped in \`<response></response>\` tags. Nothing else.`
