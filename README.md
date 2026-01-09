# Discord Approval Server MCP

English | [日本語](docs/README.ja.md)

An MCP server that sends approval requests and notifications via Discord from Claude Code.

## Setup

### 1. Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** → Enter an application name
3. Navigate to the **Bot** tab → Click **Reset Token** → Copy the token
4. In the **Bot** tab → Enable **MESSAGE CONTENT INTENT** (optional)
5. Go to **OAuth2** → **URL Generator**:
   - Scopes: `bot`
   - Bot Permissions: `Send Messages`, `Read Message History`
6. Use the generated URL to invite the bot to your server

### 2. Get the Channel ID

1. Open Discord Settings → Advanced → Enable **Developer Mode**
2. Right-click the channel where you want to receive notifications → **Copy ID**

### 3. Build

```bash
npm install
npm run build
```

### 4. Configure Claude Code

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "discord-approval": {
      "command": "node",
      "args": ["/path/to/discord-approval-mcp/dist/index.js"],
      "env": {
        "DISCORD_BOT_TOKEN": "your_bot_token",
        "DISCORD_CHANNEL_ID": "your_channel_id"
      }
    }
  }
}
```

## Available Tools

### `request_approval`

Sends an approval request and waits for the user's response.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| message | string | ✅ | The content to be approved |
| timeout | number | - | Timeout in seconds (default: 300) |

**Returns**: `Approved` / `Denied` / `Timeout`

### `notify`

Sends a notification (no response required).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| message | string | ✅ | The notification message |

### `ask_question`

Sends a question with multiple choices and waits for the user's selection.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| question | string | ✅ | The question to ask |
| options | string[] | ✅ | Array of choices (2-25 items) |
| timeout | number | - | Timeout in seconds (default: 300) |

**Returns**: The selected option / `Timeout`

## Usage Example

In Claude Code:

```
Get user approval before deploying to production
```

→ A message with buttons will be sent to Discord, waiting for approval/denial

## CLAUDE.md Configuration

To make Claude Code automatically use these tools, add the following to your `~/.claude/CLAUDE.md`:

```markdown
### discord-approval

Use `mcp__discord-approval__request_approval` for approval in these situations:
- Before deploying to production
- Before running database migrations
- Before bulk file deletions
- Before other irreversible operations

Use `mcp__discord-approval__ask_question` when you need the user to choose from multiple options:
- Selecting implementation approach
- Clarifying ambiguous instructions
- Choosing configuration values

Use `mcp__discord-approval__notify` when long-running tasks (builds, tests, etc.) complete.

## When to actively use discord approval mcp

- When prompting the user for confirmation
- When asking questions to the user
- When a task is completed
```

## License

MIT
