## Sections and Formatting

Use CAPS for section headers (not ## or #):
- CRITICAL ISSUES
- ISSUES FOUND
- POTENTIAL ISSUES
- RECOMMENDATIONS
- OVERALL ASSESSMENT

Do not include empty sections. Only include sections where you have substantive content.

IMPORTANT: Gerrit formatting rules:
- DO NOT use markdown-style bold (**text**) or italic (*text*)
- DO NOT use headers with # or ##
- USE CAPS for emphasis instead
- Use plain text for most content
- For code blocks: Start each line with a leading space (NOT backticks)
- For inline code: Use quotes like 'code' or "code" (NOT backticks)
- Use * or - for bullet points (both work)
- Block quotes: Start line with > (with or without leading space)
- CRITICAL: Never use backticks (```) anywhere - they are NOT supported by Gerrit

## CRITICAL OUTPUT REQUIREMENT

**YOUR ENTIRE OUTPUT MUST BE WRAPPED IN <response></response> TAGS.**

The review content inside the response tags should start with "🤖 Claude Code" followed by your review.

## Example Output (THIS IS THE ONLY ACCEPTABLE FORMAT)

<response>
🤖 Claude Code

CRITICAL ISSUES

SQL Logic Error - Incorrect NULL handling: The SQL expression in app/graphql/loaders/section_grade_posted_state.rb:39 has a critical flaw:

 NOT bool_or(((submissions.score IS NOT NULL AND submissions.workflow_state = 'graded') OR submissions.excused = true) AND submissions.posted_at IS NULL)

When a section has only ungraded, non-excused submissions, bool_or returns NULL (not FALSE) because no rows match the condition. The !! operator on line 41 then converts NULL to false, incorrectly indicating grades are "not posted". This contradicts the test expectation on line 135 of the spec that ungraded submissions should be considered "posted".

ISSUES FOUND

Test-Implementation Mismatch: The test "returns true if assignment has ungraded submissions that are not excused" expects true, but the implementation will return false. For ungraded, non-excused submissions:
* The inner condition evaluates to false for all rows
* bool_or(false) returns NULL (not FALSE)
* !!nil becomes false

Missing NULL Safety: In app/graphql/loaders/section_grades_present_state.rb:39, the excused field check could have inconsistent behavior with NULL values. Use COALESCE(submissions.excused, false) = true for explicit NULL handling.

RECOMMENDATIONS

Replace the SQL logic with:

 COALESCE(
   NOT bool_or(((submissions.score IS NOT NULL AND submissions.workflow_state = 'graded') OR 
   COALESCE(submissions.excused, false) = true) AND submissions.posted_at IS NULL),
   true
 )

OVERALL ASSESSMENT

The issues identified above remain unresolved in the current patchset. The refactoring approach is sound, but these specific problems need addressing before merge.
</response>

## FINAL REMINDER
Remember: Your ENTIRE output must be wrapped in <response></response> tags. Nothing else.
