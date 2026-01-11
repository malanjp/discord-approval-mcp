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

### `schedule_reminder`

Schedules a reminder to be sent to Discord after a specified delay. Use with AskUserQuestion to notify via Discord when the user doesn't respond in time.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| message | string | ✅ | The reminder message |
| delay_seconds | number | ✅ | Delay in seconds (1-3600) |

**Returns**: `{ reminder_id: string }` for cancellation

### `cancel_reminder`

Cancels a scheduled reminder.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| reminder_id | string | ✅ | The reminder ID from schedule_reminder |

**Returns**: Success / Error message

### `notify_with_status`

Sends a notification with status using Discord Embed (color-coded).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| message | string | ✅ | The notification message |
| status | string | ✅ | Status type: `success` (green), `error` (red), `warning` (yellow), `info` (blue) |
| details | string | - | Additional details (optional) |

**Returns**: Success / Error message

### `request_text_input`

Requests text input from the user via Discord Modal dialog.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| title | string | ✅ | Modal title (max 45 characters) |
| prompt | string | ✅ | Message prompting for input |
| placeholder | string | - | Placeholder text (max 100 characters) |
| multiline | boolean | - | Allow multiline input (default: false) |
| timeout | number | - | Timeout in seconds (default: 300, max: 900) |

**Returns**: The entered text / `Cancelled` / `Timeout`

### `confirm_with_diff`

Shows a code diff and requests approval from the user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| message | string | ✅ | Description of the changes |
| diff | string | ✅ | The diff to display (unified diff format recommended) |
| filename | string | - | Filename for syntax highlighting |
| timeout | number | - | Timeout in seconds (default: 300, max: 900) |

**Returns**: `Approved` / `Denied` / `Timeout`

### `poll`

Sends a poll with multiple selectable options and waits for the user's selection.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| question | string | ✅ | The question to ask |
| options | string[] | ✅ | Array of choices (2-25 items) |
| min_selections | number | - | Minimum selections required (default: 0) |
| max_selections | number | - | Maximum selections allowed (default: all options) |
| timeout | number | - | Timeout in seconds (default: 300, max: 900) |

**Returns**: Array of selected options / `Timeout`

### `request_approval_with_reason`

Sends an approval request and collects a reason when denied.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| message | string | ✅ | The content to be approved |
| timeout | number | - | Timeout in seconds (default: 300, max: 900) |

**Returns**: `{ approved: boolean, reason?: string }` / `Timeout`

### `create_thread`

Creates a Discord thread for organizing long task progress.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | ✅ | Thread name (max 100 characters) |
| message | string | - | Initial message in the thread |

**Returns**: `{ thread_id: string }` / Error message

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

Use `mcp__discord-approval__notify_with_status` for rich notifications with status indicators:
- Success notifications (green) for completed tasks
- Error notifications (red) for failures
- Warning notifications (yellow) for potential issues
- Info notifications (blue) for general information

Use `mcp__discord-approval__request_text_input` when you need free-form text input:
- Gathering error details from the user
- Requesting additional requirements
- Getting commit message modifications

Use `mcp__discord-approval__confirm_with_diff` when showing code changes for approval:
- Before applying file modifications
- Reviewing generated code changes

Use `mcp__discord-approval__poll` when multiple selections are needed:
- Selecting multiple features to implement
- Choosing which bugs to fix first

Use `mcp__discord-approval__request_approval_with_reason` when you need rejection feedback:
- Understanding why a change was rejected
- Collecting improvement suggestions

Use `mcp__discord-approval__create_thread` for organizing long tasks:
- Multi-step implementation progress
- Grouping related notifications

## When to actively use discord approval mcp

- When prompting the user for confirmation
- When asking questions to the user
- When a task is completed
```

## License

MIT
