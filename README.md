# Claude Chat Backup

A VS Code extension that automatically backs up your Claude Code conversations to readable Markdown and structured JSON formats.

## Why?

When using Claude Code, conversations can get lost when:
- The chat window is accidentally closed
- VS Code crashes or restarts
- The conversation history gets too long

This extension watches your Claude Code sessions in real-time and saves them as readable files, so you never lose your work.

## Features

- **Real-time Backup**: Automatically monitors and saves conversations as you chat
- **Dual Format**: Saves both human-readable Markdown and structured JSON
- **Project Organization**: Organizes backups by project folder
- **Session Tracking**: Each conversation session is saved separately
- **Auto-start**: Starts watching automatically when VS Code opens
- **Index File**: Auto-generated `_index.md` with a table of all conversations and their topics

## Installation

### From VSIX (Recommended)

1. Download the latest `.vsix` file from [Releases](https://github.com/gamac/claude-chat-backup/releases)
2. Open VS Code
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
4. Type "Install from VSIX" and select it
5. Choose the downloaded `.vsix` file
6. Restart VS Code

### From Source

```bash
git clone https://github.com/gamac/claude-chat-backup.git
cd claude-chat-backup
npm install
npm run compile
npx vsce package
```

## Usage

Once installed, the extension works automatically:

1. **Status Bar**: Look for "Claude Backup" in the bottom-right corner
2. **Backups Location**: Files are saved to VS Code's extension storage folder
3. **View Backups**: Use command `Claude Backup: Open Backups Folder`

### Commands

| Command | Description |
|---------|-------------|
| `Claude Backup: Start Watching` | Start monitoring conversations |
| `Claude Backup: Stop Watching` | Stop monitoring |
| `Claude Backup: Open Backups Folder` | Open the folder containing your backups |

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `claudeBackup.outputPath` | (extension storage) | Custom backup folder path |
| `claudeBackup.autoStart` | `true` | Start watching on VS Code startup |
| `claudeBackup.formats` | `["markdown", "json"]` | Output formats |

## Output Format

### Folder Structure

```
conversations/
├── ProjectName/
│   ├── _index.md              <- Auto-generated index with all conversations
│   ├── 2026-01-29_d6bdf58e.md
│   ├── 2026-01-29_d6bdf58e.json
│   ├── 2026-01-28_abc12345.md
│   └── 2026-01-28_abc12345.json
└── AnotherProject/
    ├── _index.md
    └── ...
```

### Index File (_index.md)

Each project folder contains an auto-generated index file:

```markdown
# Conversation History

**Project:** `MyProject`
**Total Conversations:** 5

| Date | Topic | Messages | File |
|------|-------|----------|------|
| 2026-01-29 | How do I create a VS Code extension? | 48 | [d6bdf58e.md](2026-01-29_d6bdf58e.md) |
| 2026-01-28 | Fix authentication bug | 32 | [abc12345.md](2026-01-28_abc12345.md) |
```

### Markdown (.md)

```markdown
# Claude Conversation

**Date:** January 29, 2026
**Session ID:** `d6bdf58e-da8b-48d3-9aa0-2bbb0bfa7b15`

---

## User (09:14:34)

How do I create a new React component?

---

## Claude (09:14:40)

To create a new React component, you can use either a function or class...
```

### JSON (.json)

```json
{
  "version": "1.0",
  "session": {
    "id": "d6bdf58e-...",
    "startTime": "2026-01-29T06:14:34.270Z",
    "messageCount": 42
  },
  "messages": [
    {
      "type": "user",
      "content": "How do I create a new React component?",
      "timestamp": "2026-01-29T06:14:34.270Z"
    }
  ]
}
```

## Restoring a Conversation

If you lose a conversation, you can restore context by:

1. Open the backup folder (`Claude Backup: Open Backups Folder`)
2. Find your conversation in `_index.md` or by date
3. Open the `.md` file
4. In a new Claude chat, say: "Read this file and continue the conversation: [paste file path]"

Claude will read the backup and continue where you left off.

## Requirements

- VS Code 1.85.0 or higher
- Claude Code extension installed and active

## How It Works

1. Claude Code stores conversation data in `~/.claude/projects/` as JSONL files
2. This extension watches those files for changes
3. When a change is detected, it parses the JSONL and converts it to Markdown/JSON
4. Files are saved with the format: `{date}_{session-id}.md`
5. An `_index.md` file is auto-generated with all conversations and their topics

## Troubleshooting

### Extension not working?

1. Make sure Claude Code is installed
2. Check if `~/.claude/projects/` folder exists
3. Open Output panel (`Ctrl+Shift+U`) and select "Claude Chat Backup"
4. Try running `Claude Backup: Start Watching` manually

### Backups not appearing?

- The extension polls for changes every 5 seconds
- Make sure you have write permissions to the backup folder
- Check the Output panel for error messages

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built for use with [Claude Code](https://claude.ai/claude-code) by Anthropic
