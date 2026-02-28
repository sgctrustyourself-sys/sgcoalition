# Coalition Command Bot

A custom Discord bot for automating the SG Coalition server organization and product drops.

## Quick Start

### 1. Install Dependencies
```powershell
cd scripts\discord-bot
npm install
```

### 2. Configure Environment
Copy `.env.template` to `.env` and fill in your values:
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
GUILD_ID=your_server_id_here
```

### 3. Deploy Commands
```powershell
npm run deploy
```

### 4. Start the Bot
```powershell
npm start
```

## Commands

- `/setup-coalition` - Automatically creates the 3-category server structure
- `/drop [product]` - Posts a professional product drop message
- `/rules` - Posts the server rules protocol
- `/verify` - Provides verification instructions

## Files

- `index.js` - Main bot logic and command handlers
- `deploy-commands.js` - Registers slash commands with Discord
- `package.json` - Dependencies and scripts
- `.env` - Configuration (create from `.env.template`)
