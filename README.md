# Gerrit CLI (ger)

> ⚠️ **Alpha Status**: This project is in early development. APIs and commands may change.

A fast, modern command-line interface for Gerrit Code Review with offline support and intelligent caching.

## Features

- **⚡ Fast & Offline** - SQLite caching for instant responses
- **🔒 Secure** - Encrypted credential storage
- **🎯 Interactive** - Beautiful terminal UI with real-time feedback
- **📊 Rich Diffs** - Multiple formats: unified, JSON, file lists
- **🛠️ Developer-friendly** - Built for daily Git workflows

## Installation

### Option 1: Download Release (Recommended)
```bash
# Download the latest release for your platform
curl -L https://github.com/your-org/gerrit-cli/releases/latest/download/ger-macos -o ger
chmod +x ger
sudo mv ger /usr/local/bin/
```

### Option 2: Build from Source
```bash
git clone https://github.com/your-org/gerrit-cli
cd gerrit-cli
bun install
bun run build
# Add to PATH or create symlink
```

## Quick Start

### 1. Initialize
```bash
ger init
```
You'll be prompted for:
- **Gerrit URL**: Your server (e.g., `https://gerrit.company.com`)
- **Username**: Your Gerrit username
- **HTTP Password**: Generate in Gerrit → Settings → HTTP Credentials

### 2. Verify Setup
```bash
ger status
```

### 3. Start Using
```bash
# View a change
ger diff 12345

# Post a comment
ger comment 12345 -m "LGTM!"
```

## Commands

### Core Commands

#### `ger init`
Set up your Gerrit credentials securely.

#### `ger status`
Check connection and configuration status.

#### `ger comment <change-id>`
Post comments on changes.
```bash
# Interactive mode
ger comment 12345

# Quick comment  
ger comment 12345 -m "Please fix the typo in line 42"
```

#### `ger diff <change-id>`
View code changes in multiple formats.

```bash
# Basic unified diff (default)
ger diff 12345

# List changed files only
ger diff 12345 --files-only

# JSON format for tooling
ger diff 12345 --format json

# Specific file diff
ger diff 12345 --file src/main.ts

# Compare patchsets
ger diff 12345 --base 1 --target 3

# Full file content
ger diff 12345 --full-files
```

## Common Workflows

### Code Review
```bash
# Check what changed
ger diff 12345 --files-only

# Review specific files
ger diff 12345 --file src/api.ts

# Leave feedback
ger comment 12345 -m "Consider using const instead of let on line 15"
```

### AI Code Review Setup
```bash
# Get diff for AI analysis
ger diff 12345 --format json > change.json

# Your AI tool processes change.json...

# Post AI-generated review
ger comment 12345 -m "$(ai-review-tool change.json)"
```

### Offline Usage
The CLI caches all data locally, so you can:
- View previously fetched diffs offline
- Read cached change information
- Work seamlessly with poor connectivity

## Configuration

Credentials are stored in `~/.gi/credentials.json` with secure file permissions.

### Environment Variables
- `GI_CONFIG_DIR` - Custom config directory (default: `~/.gi`)

## Troubleshooting

### Common Issues

**"Credentials not found"**
```bash
ger init  # Re-run setup
```

**"Connection failed"**
- Check your network connection
- Verify Gerrit URL is correct
- Ensure HTTP password is valid (not your login password!)

**"Permission denied"**
- Make sure you have access to the change
- Check if the change ID is correct

### Getting Help
```bash
ger --help           # General help
ger <command> --help # Command-specific help
```

## Tips & Tricks

1. **Use change numbers**: `ger diff 12345` works as well as full change IDs
2. **Pipe output**: `ger diff 12345 | less` for long diffs
3. **JSON integration**: Use `--format json` for custom tooling
4. **File-specific reviews**: Use `--file` to focus on specific changes
5. **Offline first**: Commands work offline with cached data

---

For development and contribution guidelines, see [DEVELOPMENT.md](DEVELOPMENT.md).