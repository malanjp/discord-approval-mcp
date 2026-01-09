# MCP Discord Approval Server

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
      "args": ["/path/to/mcp-discord-approval/dist/index.js"],
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

## Usage Example

In Claude Code:

```
Get user approval before deploying to production
```

→ A message with buttons will be sent to Discord, waiting for approval/denial

## License

MIT
