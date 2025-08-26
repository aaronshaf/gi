# Gerrit CLI (ger)

An LLM-centric command-line interface for Gerrit Code Review. Outputs XML by default for easy parsing by AI tools, with optional human-readable output via `--pretty` flag.

## Features

- **LLM-First Design**: XML output by default for AI/LLM consumption
- **Interactive Mode**: Rich terminal UI with Gerrit-style keyboard shortcuts
- **Simple & Direct**: No caching, always fresh data from Gerrit  
- **Secure**: Credentials stored in system keychain via keytar
- **Effect-based**: Built with Effect for robust error handling

### Interactive Mode Features

- **Gerrit-style Navigation**: `j/k` for up/down, `g/G` for first/last
- **Rich Visual Interface**: Bordered sections, emoji icons, status indicators
- **Quick Actions**: `c` for change details, `d` for diff, `o` to open in browser
- **Project Organization**: Changes grouped by project with visual hierarchy
- **Real-time Info**: Relative timestamps, label status, owner information

## Installation

### From Source

```bash
git clone https://github.com/aaronshaf/ger
cd ger
bun install

# For development (uses bun directly)
./bin/ger --help

# For production (builds standalone binary)
bun run build
./bin/ger --help
```

### Build Commands

```bash
# Clean build artifacts
bun run clean

# Build standalone binary (not committed to git)
bun run build

# Install globally for development
bun run install:local
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

### Incoming Changes
```bash
# List incoming changes (XML output)
ger incoming

# Human-readable output  
ger incoming --pretty

# Interactive mode with Gerrit-style keyboard shortcuts
ger incoming --interactive
```

### Open Changes in Browser
```bash
# Open change by number
ger open 12345

# Open change by URL (extracts change number)
ger open https://gerrit.example.com/c/project/+/12345
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

# Post AI-generated review
llm "Generate review for change 12345" | xargs -I {} ger comment 12345 -m "{}"
```

### Piping to AI Tools
```bash
# Get change diff and analyze
ger diff 12345 | ai-review-tool

# Check status programmatically
ger status | xmllint --xpath "//connected/text()" -
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
