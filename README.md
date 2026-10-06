# Alshival Bot

Alshival is an AI agent stack with an admin panel, platform connectors, shared agent configuration, MCP-style local tools, and guild-specific knowledge.

Discord and Slack are supported. The bot listens for normal messages that mention `alshival`, keeps channel chat history, and responds through the central agent response endpoint. GitHub repositories can be attached as Discord guild or Slack workspace knowledge sources, cloned locally, embedded into ChromaDB, and searched by the agent.

## Project Layout

```text
.
├── admin/                  # Next.js admin panel and API routes
├── backend/                # Agent backend, platform runtimes, reminders, platform manager
├── mcp/                    # Local MCP-style tool server
├── platform/               # Platform-specific runtime data
│   ├── Discord/Guilds/     # Discord guild-specific cloned sources/config
│   └── Slack/Workspaces/   # Slack workspace-specific cloned sources/config
├── chroma/                 # Local ChromaDB persisted data
├── assets/                 # App assets, including logo images
├── bot.db                  # Local SQLite runtime database
├── .env.example            # Environment variable template
└── start.sh                # Starts the full local stack
```

## Stack

- Admin: Next.js, React, TypeScript
- Backend: Node.js, TypeScript, `discord.js`
- Database: local SQLite at `./bot.db`
- Vector DB: ChromaDB in Docker
- Embeddings: `nomic-ai/nomic-embed-text-v1.5`
- Tools: local HTTP MCP-style server in `mcp/server.py`
- Platforms: Discord and Slack now, with structure for additional platforms later
- Slack uses Socket Mode, so it can run from localhost or a Raspberry Pi without a public HTTPS callback URL

## Features

- Configure Discord global settings and bot token
- Configure Slack workspace connections with per-workspace bot and Socket Mode app tokens
- Start and stop the Discord bot from the admin panel
- Start and stop all Slack workspaces or individual Slack workspace runtimes from the admin panel
- View Discord guilds and manage guild-specific settings
- View Slack workspaces and channels
- Override default agent provider/model per Discord guild
- Override default agent provider/model per Slack workspace
- Store chat history per Discord channel
- Store chat history per Slack channel
- Clear stored guild/channel chat history
- Add GitHub repos as Discord guild or Slack workspace knowledge sources
- Clone and delete platform-specific repo sources under `platform/Discord/Guilds/<guild-id>/` and `platform/Slack/Workspaces/<workspace-id>/`
- Embed Markdown files into per-guild and per-workspace Chroma collections
- Search guild knowledge with `discord_guild_kb`
- Search cloned codebases when the agent needs deeper repo context
- Configure OpenAI and Anthropic API keys
- Configure default Agent provider/model
- Configure GitHub access, PATs, and SSH keys
- MCP admin page for local tools
- GIF search tool through KLIPY
- Reminder tools with a once-per-minute reminder delivery job

## Requirements

- Node.js 20+ recommended
- npm
- Python 3
- Docker
- Git
- `rg` / ripgrep for code search tools

On Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y git docker.io python3 ripgrep
```

Install Node using your preferred method. The Raspberry Pi deployment currently uses nvm with Node `v24.15.0`.

## Setup

Install dependencies:

```bash
cd backend
npm ci

cd ../admin
npm ci
```

Create local environment config:

```bash
cd ..
cp .env.example .env
```

Edit `.env` as needed:

```env
ADMIN_PORT=3000
ADMIN_HOST=127.0.0.1
BACKEND_HOST=127.0.0.1
BACKEND_PORT=4000
MCP_HOST=127.0.0.1
MCP_PORT=4100
CHROMA_HOST=127.0.0.1
CHROMA_PORT=8000
KNOWLEDGE_SYNC_INTERVAL_MS=3600000
KNOWLEDGE_SYNC_INITIAL_DELAY_MS=30000
```

For LAN or remote access to the admin panel, set:

```env
ADMIN_HOST=0.0.0.0
```

## Running Locally

Start the full stack:

```bash
./start.sh
```

This starts:

- ChromaDB Docker container
- MCP tool server
- backend server
- Next.js admin panel

Default URLs:

```text
Admin:   http://127.0.0.1:3000
Backend: http://127.0.0.1:4000
MCP:     http://127.0.0.1:4100
Chroma:  http://127.0.0.1:8000
```

If a port is already in use, update `.env` and restart `./start.sh`.

## Admin Panel

The admin panel includes:

- General
  - Language Models
- Agent
- MCP
- Platforms
  - Discord
    - Global Settings
    - Guilds
  - Slack
    - Global Settings
    - Workspaces
    - Channels
  - GitHub
    - Global Settings

Use the admin panel to configure credentials, provider/model settings, Discord bot state, GitHub access, MCP tools, and guild knowledge.

## Discord Setup

Create a Discord application and bot in the Discord Developer Portal.

Required OAuth2 scopes:

```text
bot
```

Useful bot permissions:

```text
View Channels
Send Messages
Read Message History
Embed Links
Attach Files
```

The bot responds when a message contains:

```text
alshival
```

It does not require slash commands or prefix commands.

## Slack Setup

Slack app credentials are workspace-specific. To connect Alshival to multiple Slack workspaces, create and install one Slack app per workspace, then save that workspace's bot token and app-level token in the Alshival admin panel.

Alshival uses Socket Mode, so it can run from localhost, WSL, or the Raspberry Pi without exposing a public HTTPS events endpoint.

### Create The Slack App

In <https://api.slack.com/apps>:

1. Create a new app.
2. Choose the workspace this app will connect to.
3. Open **Socket Mode** and enable it.
4. Open **Basic Information**.
5. Under **App-Level Tokens**, create a token with this scope:

```text
connections:write
```

The app-level token starts with:

```text
xapp-
```

Save this token for the Alshival Slack Workspaces page.

### Configure Bot OAuth Scopes

Open **OAuth & Permissions** and add these bot token scopes:

```text
app_mentions:read
chat:write
channels:read
channels:history
files:read
groups:read
groups:history
im:read
im:history
mpim:read
mpim:history
team:read
users:read
```

`files:read` is required for the bot to read Slack uploads such as PDFs, Word documents,
spreadsheets, images, CSVs, and text files.

Optional scopes:

```text
chat:write.public
channels:join
im:write
mpim:write
```

Use the optional scopes only if needed:

- `chat:write.public`: lets the bot post to public channels without being a member.
- `channels:join`: lets the bot join public channels through the API if that is added later.
- `im:write` and `mpim:write`: let the bot open direct-message or group-DM conversations proactively. Normal replies to DMs that users already started do not need these.

After changing scopes, install or reinstall the app to the workspace. Copy the **Bot User OAuth Token** from **OAuth & Permissions**. It starts with:

```text
xoxb-
```

Save this token for the Alshival Slack Workspaces page.

### Subscribe To Bot Events

Open **Event Subscriptions**, enable events, then subscribe to these bot events:

```text
app_mention
message.channels
message.groups
message.im
message.mpim
```

Use `app_mentions:read`/`app_mention` if you only want direct mentions. Use the `message.*` events if you want Alshival to also respond when someone writes `alshival` without an app mention.

Because Socket Mode is enabled, Slack does not need a public Request URL for events.

### Connect The Workspace In Alshival

Start the stack, then open:

```text
http://127.0.0.1:3000/platforms/slack/workspaces
```

For Raspberry Pi deployment, use the configured admin port, currently:

```text
http://127.0.0.1:3004/platforms/slack/workspaces
```

Paste:

- Bot token: the `xoxb-` Bot User OAuth Token
- Socket Mode app token: the `xapp-` app-level token

Keep **Enable this workspace** checked and click **Save workspace**. The admin panel validates the bot token with Slack, reads the workspace metadata, stores both tokens in `bot.db`, and starts that workspace runtime.

Invite the Slack app to any public or private channels where it should read normal messages:

```text
/invite @Alshival
```

The Slack bot responds when:

```text
alshival
```

appears in a message, or when the Slack bot is mentioned directly. It can also respond in DMs when the `message.im` event and `im:history` scope are configured.

## GitHub Knowledge Sources

GitHub sources are configured per Discord guild.
For Slack, GitHub sources are configured per Slack workspace.

When a repo is added as a guild knowledge source:

1. The repo is cloned under `platform/Discord/Guilds/<guild-id>/`.
2. Markdown files are embedded into the guild's Chroma collection.
3. The agent can search the collection with `discord_guild_kb`.
4. The agent can search the cloned codebase for deeper implementation details.

When a source is removed, the corresponding local clone is deleted.

Slack workspace knowledge sources are cloned under:

```text
platform/Slack/Workspaces/<workspace-id>/Knowledge/GitHub/
```

For private repos, configure GitHub access in the GitHub platform settings.

GitHub repository listing supports multiple personal access tokens. Add one token per GitHub org or owner that Alshival needs to pull from. The repository picker aggregates repos from every configured token and deduplicates by `owner/repo`.

Each token should have read access to repository metadata and contents for its org. Fine-grained PATs should be scoped to the target org or owner and allow repository read access.

Repositories can also be added without appearing in the picker. In a Discord guild or Slack workspace knowledge panel, choose **Add remote origin** and paste a GitHub remote such as:

```text
https://github.com/Alshival-Ai/alshival-bot.git
git@github.com:Alshival-Ai/alshival-bot.git
```

The app normalizes GitHub HTTPS remotes to SSH clone URLs before cloning.

Cloning and hourly sync use the GitHub SSH key configured in the GitHub platform settings. Make sure that SSH key also has access to private repos selected as knowledge sources.

## Knowledge Sync

The backend runs an automatic GitHub knowledge sync service. It starts shortly after backend startup, then runs once per hour by default.

For every configured Discord guild or Slack workspace knowledge source, the sync service:

1. Fetches and updates the local GitHub clone.
2. Computes a manifest of Markdown and MDX file content hashes.
3. Skips Chroma updates completely when the Markdown manifest is unchanged.
4. Re-embeds only changed or newly added Markdown files when a prior manifest exists.
5. Removes vectors for deleted Markdown files.

The default schedule can be tuned with:

```env
KNOWLEDGE_SYNC_INTERVAL_MS=3600000
KNOWLEDGE_SYNC_INITIAL_DELAY_MS=30000
```

The sync service uses the GitHub SSH key configured in the GitHub platform settings.

## Agent Settings

Default agent settings are configured under `Agent`.

Each Discord guild can override:

- provider
- model ID

Model names are entered directly, for example:

```text
gpt-5.5
```

The app verifies model availability when saving.

## MCP Tools

The local MCP-style server runs from:

```text
mcp/server.py
```

Current tools include:

- GIF search
- Discord guild knowledge search
- Slack workspace knowledge search
- Codebase search
- Reminders

Tool configuration is available in the admin panel under `MCP`.

## Runtime Data

Runtime files are intentionally local and should not be committed:

```text
bot.db
bot.db-shm
bot.db-wal
chroma/
platform/
admin/node_modules/
backend/node_modules/
admin/.next/
```

SQLite uses WAL mode, so if copying `bot.db` manually, checkpoint it first:

```bash
sqlite3 bot.db 'PRAGMA wal_checkpoint(FULL);'
```

Then copy `bot.db` after the checkpoint completes.

## Raspberry Pi Deployment

The current Raspberry Pi target is available through:

```bash
ssh RaspberryPi-16gb-2
```

The app is deployed at:

```text
/home/data-team/alshival-bot
```

The systemd service is:

```text
alshival.service
```

Useful service commands:

```bash
sudo systemctl status alshival
sudo systemctl restart alshival
sudo systemctl stop alshival
sudo journalctl -u alshival -f
```

The service runs:

```bash
/home/data-team/alshival-bot/start.sh
```

It sources nvm before starting so Node is available to systemd.

To access the admin panel through an SSH tunnel:

```bash
ssh -L 3004:127.0.0.1:3004 RaspberryPi-16gb-2
```

Then open:

```text
http://127.0.0.1:3004
```

## Updating The Raspberry Pi

From the Pi:

```bash
cd /home/data-team/alshival-bot
git pull

cd backend
npm ci

cd ../admin
npm ci

sudo systemctl restart alshival
```

If runtime state changed locally and needs to be copied to the Pi:

```bash
sqlite3 bot.db 'PRAGMA wal_checkpoint(FULL);'
rsync -az --delete .env bot.db chroma platform RaspberryPi-16gb-2:~/alshival-bot/
```

## Development Commands

Backend:

```bash
cd backend
npm run start
npm run typecheck
```

Admin:

```bash
cd admin
npm run dev
npm run build
npm run lint
```

Full stack:

```bash
./start.sh
```

## Switch Manager prototype

Open **Infrastructure → Switch Manager** at `/infrastructure/switch-manager` in the
existing Next.js admin app. This is explicitly **Demo data**: it uses no hardware,
SSH, API credentials, DHCP writes, disk imaging, 1Password writes, or live MCP
execution. Deployment and live integration are separate follow-up work.

The Rack, Network, Fleet, Provisioning and Activity views share selection through
`view`, `port`, `device`, `detail` and `job` URL parameters. Demo plans, observations,
jobs, inventory and provisioning progress are retained in this browser's
`alshival-switch-manager-demo-v1` localStorage entry. Reset clears only this demo
state. Browser storage is optional; blocked storage leaves an in-memory demo.
Jobs progress only while the page is open and resume on reopening it.

### Walkthrough

- Port **1/1/16** is the completed Pi 5 / 8 GB / VLAN 41 / 192.168.41.116 example:
  nominal 64 GB SD, no NVMe detected.
- Fleet's **16 GB spares with NVMe** shortcut selects pi-spare-12. **HAT only**
  includes pi-spare-08 and pi-new-17; a HAT never implies a detected drive.
- Rack's attention rows show conflicting historical storage on port 8, an
  unreachable collector with old evidence on port 24, and a swapped MAC on port 40.
- **Provision a Pi** starts the second scenario on port 17. Check .41.117 to see
  its conflicting reservation; try .41.118, optionally simulate a collector outage,
  then run complete checks. Generate/download the SD handoff, simulate physical
  installation, retry the package-mirror error, and finish by marking the board
  available. The handoff includes a fixture public key (no private key retained),
  fixture image checksum, cloud-init/network settings and target-card requirements.
  It is a demonstration artifact, not a usable production imaging authorization.
- The inspector previews VLAN moves and PoE cycles. Rack's **Draft with Alshival**
  uses the same plan/execute/check/activity path. Review plans in Operations before
  running them; click activity job links to inspect verification evidence.

### Adapter and future MCP contracts

`admin/lib/switch-manager/engine.ts` defines switches, ports, devices, networks,
allocations, observations, plans, jobs and events behind `OperationsAdapter`.
Board identity is serial/MAC; attachment is a separate port reference. Proposed
plans capture identity; execution revalidates identity, current collector evidence,
address evidence and unfinished work. Duplicate execution returns the existing
job. Human and Alshival are simulated actors under the same demo scope and rules.
No browser actor choice is an authorization mechanism for a future live adapter.

| Future MCP group | Adapter boundary | Required live behavior |
| --- | --- | --- |
| Inspect | `inspect`, `getSnapshot`, address observations | Scope-filtered switch/device/port/network/power/address/health reads with source, collection time and explicit unavailable evidence. |
| Plan | `propose`, `checkAddress`, `handoff` | Validate intended board attachment, address ownership, network policy and impact; return a stable plan ID and imaging handoff. |
| Execute | `execute` | Validate server-side delegated admin capabilities and plan revision/scope; return a job ID, use idempotency and reserve addresses atomically. |
| Follow | `follow`, subscriptions and activity | Persist progress/evidence, support safe retry, expose actor and affected board/port; never treat historical evidence as a fresh observation. |

Future adapters: Aruba supplies port/MAC/PoE observations; OPNsense owns network
policy and routing; pi-admin supplies provisioning DHCP; Pi agents/SSH supply
host checks; 1Password stores documentation and credential references. Secrets
remain server-side. New client VLANs need a network-design workflow. Disk erasure
belongs to the local imaging agent and requires an explicitly identified target
and matching authorization; the Switch Manager plan alone cannot authorize it.

The demo's candidate checks and image signatures are simulated. A production
implementation must replace them with authoritative observations, signed image
manifests, trusted SSH host enrollment, transactional allocations, server-side
scope validation, durable workers and real evidence. No network safety guarantee
is inferred from ping silence.

### Isolated checks

Use a clean source worktree without runtime databases or environment files. From
`admin/`, use Node 24 and the installed package lock:

```bash
npm ci
node --test tests/switch-manager.test.mjs
npx eslint 'app/(admin)/infrastructure/switch-manager/' app/components/AdminShell.tsx lib/switch-manager/engine.ts tests/switch-manager*.mjs
npx tsc --noEmit
npm run build -- --webpack
npm run dev -- --webpack --hostname 127.0.0.1 --port 18786
```

The isolated preview uses webpack when node_modules is linked outside the worktree
(Turbopack rejects that symlink). No production configuration was changed for this.
The browser acceptance script uses Playwright when installed by the local test
harness; `PLAYWRIGHT_MODULE` may point to its `index.mjs`, and
`PLAYWRIGHT_EXECUTABLE` may select the installed Chromium binary:

```bash
node tests/switch-manager.browser.mjs
```

It checks 52 keyboard-selectable ports, fleet storage distinctions, disagreement
and outage cases, topology/table parity, human/agent jobs, provisioning conflict
and retry, reload persistence, mobile detail URLs, reduced motion and reset.
`SWITCH_DEMO_URL` accepts only localhost; screenshots go to
`/tmp/switch-manager-artifacts` or `SWITCH_ARTIFACTS`.

### Alshival.Ai portal bundle

The portal mounts this same fixture workspace behind its administrator capability
at `/staff/infrastructure/switch-manager/`. It does not proxy the bot's settings,
API routes, or hardware tools. The portal shell owns authentication/navigation;
a shadow root isolates the workspace CSS. URL selection and browser history use
native location events in both hosts.

To rebuild the portable artifact from this repository's committed source:

```bash
cd admin
npm ci
node portal/build.mjs /path/to/website/customer_hub/static/customer_hub/switch-manager.js
```

Commit the generated JS and its linked license file in the website repository,
record this source commit in `docs/switch-manager.md`, and increment the script
version in the portal template. The normal website release deploys the bundle;
no bot service restart is needed. Only browser-local fixtures are persisted.
The browser acceptance script supports `SWITCH_DEMO_PATH` for the portal route.

The portal bundle follows the host's resolved `html.dark-style` appearance,
including Light/Dark/System preference changes, without remounting the workspace.
`appearance.css` supplies the light palette and shared hardware-label contrast;
the original graphite palette remains the dark default in standalone Next.js.
Run `admin/tests/switch-manager-theme.browser.mjs` against a local portal fixture
to check every view, the tray, saved/system preferences, and mobile layouts.
