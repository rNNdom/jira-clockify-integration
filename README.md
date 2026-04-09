# workstart

CLI that kicks off a work session on a Jira ticket — starts a Clockify timer, opens VS Code, and optionally creates a feature branch. When you stop the timer, elapsed time is logged back to Jira's time tracker.

## Install

```bash
npm install -g .
```

## Setup

Create a `~/.workstartrc` file with your credentials:

```env
JIRA_DOMAIN=your-team.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token
CLOCKIFY_API_KEY=your-clockify-api-key
```

You can generate these tokens at:
- **Jira**: https://id.atlassian.com/manage-profile/security/api-tokens
- **Clockify**: https://app.clockify.me/user/preferences#advanced

## Usage

```bash
workstart <issue-key> [project-path] [options]
```

### Examples

```bash
# Start a timer only (no VS Code)
workstart AURORE-123

# Start working on a ticket and open VS Code
workstart AURORE-123 ~/projects/my-app

# Start and create a feature branch from develop
workstart AURORE-123 ~/projects/my-app --new-feature
```

### Options

| Option           | Description                                              |
|------------------|----------------------------------------------------------|
| `--new-feature`  | Checkout `develop`, pull, and create `feature/<issue-key>` branch |

## What it does

1. Fetches the issue summary from Jira
2. If a project path is given:
   - Creates a `feature/<issue-key>` branch from `develop` (if `--new-feature`)
   - Opens VS Code at the project path
3. Starts a Clockify timer with the description `[ISSUE-KEY]: Summary`
5. Waits for you to press **Enter** or **Ctrl+C**
6. Stops the Clockify timer
7. Logs the elapsed time to the Jira issue's worklog

## Requirements

- Node.js >= 18
- `code` CLI available in PATH ([VS Code docs](https://code.visualstudio.com/docs/setup/mac#_launching-from-the-command-line))
- Git (for `--new-feature`)

## License

MIT
