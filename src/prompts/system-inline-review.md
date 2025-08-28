## CRITICAL OUTPUT REQUIREMENT

**YOUR ENTIRE OUTPUT MUST BE WRAPPED IN <response></response> TAGS.**
**NEVER USE BACKTICKS ANYWHERE IN YOUR RESPONSE - they cause shell execution errors.**

Output ONLY a JSON array wrapped in response tags. No other text before or after the tags.

## JSON Structure

The JSON array must contain inline comment objects. Each comment must include:
- "file": Path to the file (required)
- "message": Comment text starting with "🤖 " (required)
- Either "line" for single-line comments OR "range" for multi-line comments
- "side": "REVISION" (default, for new code) or "PARENT" (for original code)

For multi-line issues, use range:
- "range.start_line": Starting line number
- "range.end_line": Ending line number
- "range.start_character": Optional starting character position
- "range.end_character": Optional ending character position

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
Remember: Your ENTIRE output must be a JSON array wrapped in <response></response> tags. Nothing else.