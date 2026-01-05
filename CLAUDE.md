# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

tiny-app.dev - a lightweight product that lets users create and run small "micro-apps" stored as single HTML files in Google Drive.

## Build Commands

```bash
npm install     # Install dependencies
npm run dev     # Start dev server (http://localhost:5173)
npm run build   # Build for production (outputs to dist/)
npm run preview # Preview production build
```

## Architecture

**Frontend-only** static app (no backend for MVP):
- Vanilla JS + Web Components
- Vite for bundling
- Google Drive API called directly from browser
- OAuth 2.0 with access-token-only (no refresh tokens)

## Project Structure

```
src/
├── main.js                    # Entry point, hash-based router
├── styles/main.css            # Global styles
├── lib/
│   ├── google-auth.js         # OAuth flow (signIn, handleCallback, getToken)
│   └── drive-client.js        # Drive API wrapper (CRUD for apps/sessions)
├── components/
│   ├── app-library.js         # Main view: list/create/delete apps
│   ├── app-runner.js          # Run app in sandboxed iframe
│   ├── app-editor.js          # Simple textarea for editing app.html
│   └── session-manager.js     # Dropdown to switch/create sessions
└── templates/
    └── default-app.html       # Counter example template
```

## Data Model (Google Drive)

Apps stored under `tiny-app.dev/` folder:
```
tiny-app.dev/<appId>/
  ├── app.html        # Single-file app implementation
  ├── manifest.json   # App metadata
  ├── params.json     # Configuration values
  └── sessions/
      └── <name>.json # Session data
```

## Message Protocol (Parent ↔ Iframe)

**Parent → Iframe:**
- `{ type: 'init', params, session, manifest }` - sent when iframe signals ready

**Iframe → Parent:**
- `{ type: 'ready' }` - request init payload
- `{ type: 'update-session', data }` - save session state (debounced 1s)

## Setup

1. Create Google Cloud project
2. Enable Drive API
3. Create OAuth 2.0 credentials (Web application)
4. Add authorized JavaScript origins (localhost:5173 for dev)
5. Add authorized redirect URI (your domain root)
6. Update `CLIENT_ID` in `src/lib/google-auth.js`

## Security

- Iframe sandbox: `allow-scripts` only (no same-origin, forms, popups)
- OAuth tokens stored in sessionStorage, never exposed to iframe
- Drive scope: `drive.file` (only files created by app)
