# Gerrit CLI (ger)

An LLM-centric command-line interface for Gerrit Code Review. Outputs XML by default for easy parsing by AI tools, with optional human-readable output via `--pretty` flag.

## Features

- **LLM-First Design**: XML output by default for AI/LLM consumption
- **Simple & Direct**: No caching, always fresh data from Gerrit
- **Secure**: Credentials stored in system keychain via keytar
- **Effect-based**: Built with Effect for robust error handling

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

### Check Connection
```bash
# XML output (default)
ger status

# Human-readable output
ger status --pretty
```

### Post Comment
```bash
# XML output (default)
ger comment 12345 -m "LGTM!"

# Human-readable output
ger comment 12345 -m "Looks good!" --pretty

# Interactive mode (prompts for comment text)
ger comment 12345

# Piped input (read comment from stdin)
echo "LGTM!" | ger comment 12345
cat review-notes.txt | ger comment 12345 --pretty
```

### Get Diff
```bash
# XML output (default)
ger diff 12345

# Human-readable output
ger diff 12345 --pretty

# List changed files only
ger diff 12345 --files-only

# Specific file
ger diff 12345 --file src/main.ts
```

### List My Changes
```bash
# XML output (default)
ger mine

# Human-readable output
ger mine --pretty
```

### Abandon Change
```bash
# XML output (default)
ger abandon 12345

# Human-readable output
ger abandon 12345 --pretty

# With reason
ger abandon 12345 -m "Superseded by change 12346"
```

### Workspace Operations
```bash
# List workspace changes (XML output)
ger workspace

# Human-readable output
ger workspace --pretty
```

## LLM Integration Examples

### With Claude/ChatGPT
```bash
# Get diff in XML format for LLM analysis
ger diff 12345 | llm "Review this code change"

# Generate and post AI review using piped input
llm "Generate code review for change 12345" | ger comment 12345

# Chain AI analysis and commenting
ger diff 12345 | llm "Analyze this diff and provide feedback" | ger comment 12345 --pretty
```

### Piping to AI Tools
```bash
# Get change diff and analyze
ger diff 12345 | ai-review-tool

# Post pre-written review from file
cat automated-review.txt | ger comment 12345

# Check status programmatically
ger status | xmllint --xpath "//connected/text()" -

# Batch process multiple reviews
echo "LGTM - automated approval" | ger comment 12345
echo "Ship it!" | ger comment 12346 --pretty
```

## Output Format

All commands output XML by default:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<comment_result>
  <status>success</status>
  <change_id>12345</change_id>
  <change_number>12345</change_number>
  <change_subject><![CDATA[Fix authentication bug]]></change_subject>
  <change_status>NEW</change_status>
  <message><![CDATA[LGTM!]]></message>
</comment_result>
```

Use `--pretty` flag for human-readable output:
```
✓ Comment posted successfully!
Change: Fix authentication bug (NEW)
Message: LGTM!
```

## Development

Built with:
- **Bun** - Runtime and package manager
- **Effect** - Type-safe error handling
- **TypeScript** - With isolatedDeclarations
- **Commander** - CLI argument parsing
- **Keytar** - Secure credential storage

### Testing
```bash
bun test
bun run typecheck
bun run lint
```

## License

MIT
