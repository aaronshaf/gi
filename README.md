# Gerrit CLI (ger)

Command-line interface for Gerrit Code Review. XML output by default for LLM/automation compatibility, human-readable output with `--pretty`.

## Features

- **LLM-Friendly**: XML output for AI/automation pipelines
- **Interactive UI**: Terminal UI for change selection and navigation
- **Secure**: Credentials stored in system keychain
- **Effect-based**: Robust error handling and functional architecture

## Installation

```bash
git clone https://github.com/your-org/ger
cd ger
bun install
bun run build
```

## Setup

Set environment variables and run init:

```bash
export GERRIT_HOST="https://gerrit.example.com"
export GERRIT_USERNAME="your-username"
export GERRIT_PASSWORD="your-http-password-from-gerrit-settings"

ger init
```

## Commands

### Initialize
```bash
ger init
```

### Connection Status
```bash
ger status
ger status --pretty
```

### Show Change Details
```bash
# Complete change info with metadata, diff, inline comments, and review activity
ger show 12345
ger show 12345 --pretty
```

### List Changes
```bash
# Your changes
ger mine
ger mine --pretty

# Incoming reviews
ger incoming
ger incoming --pretty

# Workspace changes (local branch tracking)
ger workspace
ger workspace --pretty
```

### Comments

#### Overall Comments
```bash
# Using -m flag
ger comment 12345 -m "LGTM"

# Piping plain text (becomes overall comment message)
echo "Review text" | ger comment 12345
cat review.txt | ger comment 12345
```

#### Line-Specific Comments
```bash
# Single line comment (line numbers refer to post-merge view)
ger comment 12345 --file src/main.ts --line 42 -m "Consider error handling"

# Mark as unresolved
ger comment 12345 --file src/main.ts --line 42 -m "Fix this" --unresolved
```

#### Batch Line Comments
```bash
# Batch line-specific comments via JSON array
# Format: [{"file": "path", "line": number, "message": "text"}]
echo '[
  {"file": "src/main.ts", "line": 10, "message": "Add type annotation"},
  {"file": "src/utils.ts", "line": 25, "message": "Extract to constant"},
  {"file": "src/api.ts", "line": 100, "message": "Handle error", "unresolved": true}
]' | ger comment 12345 --batch

# From a file
cat comments.json | ger comment 12345 --batch
```

#### View Comments
```bash
# View all comments with diff context
ger comments 12345
ger comments 12345 --pretty
```

### Diff
```bash
# Full diff
ger diff 12345
ger diff 12345 --pretty

# List changed files
ger diff 12345 --files-only

# Specific file
ger diff 12345 --file src/main.ts
```

### Change Management
```bash
# Open in browser
ger open 12345

# Abandon
ger abandon 12345
ger abandon 12345 -m "Reason"
```

## LLM Integration

```bash
# Review with AI
ger diff 12345 | llm "Review this code"

# AI-generated comment
llm "Review change 12345" | ger comment 12345

# Complete change analysis
ger show 12345 | llm "Summarize this change and its review status"

# Automated approvals
echo "LGTM" | ger comment 12345
```

## Output Formats

### XML (Default)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<comment_result>
  <status>success</status>
  <change_id>12345</change_id>
  <message><![CDATA[LGTM]]></message>
</comment_result>
```

### Pretty (--pretty flag)
```
Comment posted successfully
Change: Fix authentication bug (NEW)
Message: LGTM
```

## Development

### Stack
- **Bun** - Runtime and package manager
- **Effect** - Type-safe error handling and functional architecture
- **TypeScript** - With isolatedDeclarations
- **Ink** - Terminal UI components
- **Commander** - CLI argument parsing
- **Keytar** - Secure credential storage

### Testing
```bash
bun test          # Run tests with 87.6% coverage
bun run typecheck # Type checking
bun run lint      # Linting with oxlint and biome
```

## License

MIT
