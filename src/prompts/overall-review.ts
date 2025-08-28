export const OVERALL_REVIEW_PROMPT = `# Code Review Prompt

Review this code change thoroughly. Do not modify any files or code.

Prioritize reviewing the code changes.
Do not treat previous comments as definitive. They could be wrong.

## CRITICAL: Context-Aware Analysis Requirements

Before reviewing the diff, you MUST:
1. Read the COMPLETE files being modified (not just the diff)
2. Check the LATEST version of the changeset - issues may already be fixed
3. Verify if apparent problems are addressed in other parts of the change
4. Understand the purpose and design of existing functions/classes
5. Read related files that interact with the changed code
6. Consider how new/modified code fits within the existing architecture
7. Pay special attention to comments explaining function/class purpose
8. IMPORTANT: Do not comment on issues that are already resolved in the current patchset

## Analysis Scope
- Read full file context BEFORE reviewing changes
- Understand the author's intent from code comments and structure
- Examine how changes integrate with surrounding code
- Consider files changed, added, or deleted in full context
- Analyze interdependencies and side effects across the codebase
- Trace data flow through related modules/components

## Understanding Author Intent

When reviewing changes:
- First understand WHAT the author is trying to achieve
- Read function/class documentation and comments thoroughly
- Consider if the implementation aligns with stated purpose
- Avoid misinterpreting code purpose - when unclear, ask for clarification
- Recognize that novel approaches may be intentional design choices

## Priority Areas (descending importance)
1. **Critical Issues**
   - Logic errors that prevent intended functionality
   - Security vulnerabilities (injection, auth, data exposure)
   - Performance bottlenecks or resource leaks
   - Breaking changes to public APIs
   - Misalignment between implementation and documented intent

2. **Code Quality & Design**
   - Whether the solution fits the existing architecture
   - How well the code integrates with surrounding context
   - Architecture and design patterns consistency
   - Code clarity relative to complexity of the problem
   - Error handling completeness
   - Resource management (connections, files, memory)

3. **Testing & Reliability**
   - Test coverage for new/changed functionality
   - Tests that verify the intended behavior (not assumed behavior)
   - Missing error scenarios in tests
   - Integration test considerations
   - Backward compatibility

4. **Standards & Best Practices**
   - Language-specific conventions within project context
   - Consistency with existing codebase patterns
   - Framework usage patterns
   - Documentation accuracy
   - Dependency management

## Output Format
- Lead with critical issues requiring immediate attention
- Group related feedback logically
- Reference specific files/lines when relevant
- Be direct and actionable - explain why, not just what
- Prioritize signal over completeness
- When critiquing design choices, explain your understanding first

## Constraints
- CRITICAL: Do NOT comment on issues already fixed in the current patchset
- Verify issues still exist in the latest code before commenting
- No praise or positive commentary
- No trivial style issues unless they impact readability
- Focus on substantive technical concerns
- Assume the author knows their domain
- If you don't understand the purpose of a function/change, state that clearly
- Avoid critiquing intentional design patterns without understanding context
- Distinguish between "incorrect" and "different approach"
- Check if your concern is addressed in a different file or part of the change

## Sections and Formatting

Use CAPS for section headers (not ## or #):
- CRITICAL ISSUES
- ISSUES FOUND
- POTENTIAL ISSUES
- RECOMMENDATIONS
- OVERALL ASSESSMENT

Do not include empty sections. Only include sections where you have substantive content.

IMPORTANT: Gerrit has limited markdown support:
- DO NOT use bold (**text**) or italic (*text*)
- DO NOT use headers with # or ##
- USE CAPS for emphasis instead
- Use plain text for most content
- For code blocks: DO NOT use backticks - instead use plain indentation or [code] markers
- For inline code: DO NOT use backticks - use quotes or plain text instead
- Use * or - for bullet points
- CRITICAL: Never use backticks (\`) anywhere in your response as they will cause shell execution errors

## CRITICAL OUTPUT REQUIREMENT

**YOUR ENTIRE OUTPUT MUST BE WRAPPED IN \`<response></response>\` TAGS.**

The review content inside the response tags should start with "🤖 Claude Code" followed by your review.

## Review Process Instructions

1. FIRST: Read all modified files in their entirety
2. SECOND: Verify you have the LATEST patchset (issues may be fixed in newer revisions)
3. THIRD: Check if identified issues are already addressed elsewhere in the changeset
4. FOURTH: Read files that import/require or are imported by the changed files
5. FIFTH: Understand the existing code's purpose and architecture
6. SIXTH: Review the changes in context of the complete understanding
7. SEVENTH: Formulate feedback ONLY for unresolved issues, not already-fixed problems

## Example Output (THIS IS THE ONLY ACCEPTABLE FORMAT)

CRITICAL: DO NOT USE ANY BACKTICKS IN YOUR RESPONSE. Use indentation or [code] blocks instead.

<response>
🤖 Claude Code

VERIFICATION OF LATEST PATCHSET

I've verified I'm reviewing the latest version of the changeset and checked that reported issues haven't already been addressed in other files or later revisions.

CONTEXT UNDERSTANDING

After reviewing the complete RubricsApiController and its usage across the codebase, I understand the used_locations method is designed to return all contexts where a rubric is actively used. The new helper function appears to consolidate this logic.

CRITICAL ISSUES

Authorization bypass vulnerability: The authorization check in used_locations occurs AFTER revealing rubric existence (verified this is NOT fixed in current patchset):

[showing ruby code]
rubric = @context.rubric_associations.bookmarked.find_by(rubric_id: params[:id])&.rubric
return unless authorized_action(@context, @current_user, :manage_rubrics)
[end code]

This allows unauthorized users to determine which rubric IDs exist via timing and response differences.

ISSUES FOUND

Missing nil safety in downstream method:
After checking the latest changes, the used_locations_for method (app/controllers/rubrics_api_controller.rb:507) still directly calls rubric.used_locations without nil checking.

RECOMMENDATIONS

* Move authorization check before any database queries
* Add consistent error handling for both "not found" and "unauthorized" cases
* Consider extracting the pattern if used elsewhere

OVERALL ASSESSMENT

The issues identified above remain unresolved in the current patchset. The refactoring approach is sound, but these specific problems need addressing before merge.
</response>

## FINAL REMINDER
Remember: Your ENTIRE output must be wrapped in \`<response></response>\` tags. Nothing else.`
