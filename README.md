<div align="center">

# Coding Drives

A native Windows dashboard for your local coding projects — open them in VS Code, Claude Code, or Codex, back them up safely, and publish to GitHub from one place.

[![License: MIT](https://img.shields.io/badge/License-MIT-6a4dff.svg)](LICENSE) ![Version](https://img.shields.io/badge/version-1.2.8-1f1f23.svg) [![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078d6.svg)](#) [![Built with Electron](https://img.shields.io/badge/built%20with-Electron-47848F.svg)](https://www.electronjs.org/)

</div>

---

## Overview

Point Coding Drives at any number of root folders and every subfolder becomes a card. Each card detects the project's stack (Next.js, React, Node, Python, Rust, Flutter, Go, Static), tracks its status, and gives you one-click access to **VS Code**, **Claude Code**, or **Codex**. The **Backup** action runs a safe robocopy mirror to a folder of your choice. The **Publish to GitHub** action mirrors the project to a clean public copy (excluding secrets and build artifacts), generates a README, LICENSE, and issue templates, and pushes it to GitHub as a public repo with a release.

Everything runs locally — no accounts, no telemetry, no cloud sync.

## Installation

Two ways to get started:

### Option 1 — Download the installer (no setup)

Grab the latest signed Windows installer from the [Releases page](https://github.com/cleaneramade/Coding-Drives/releases) and run it. The app installs per-user (no admin prompt) and creates Desktop + Start Menu shortcuts.

### Option 2 — Run from source

Requirements: [Node.js 20+](https://nodejs.org/) and Windows.

```bash
git clone https://github.com/cleaneramade/Coding-Drives.git
cd Coding-Drives
npm install
npm run dev
```

To build your own installer:

```bash
npm run build
```

The installer lands in `dist/Coding Drives Setup 1.2.8.exe`.

## First launch

When the app opens for the first time the project grid will be empty. Click the **Settings** button in the top right and:

1. **Scan folders** — add one or more root folders (e.g. `C:\Users\you\Documents\Code`). Every subfolder becomes a project card.
2. **Backup destination** — pick where backups should land. Defaults to `Documents\Coding Drives Backups` if left blank.
3. *(Optional)* **App logo** — replace the brand mark with your own.

That's it. The app rescans whenever the window regains focus, so dropping a new folder into one of your scan roots immediately surfaces it as a card.

## Publishing to GitHub

The **⋯ → Publish to GitHub** action on any project card requires the [GitHub CLI](https://cli.github.com/) installed and authenticated (`gh auth login`). Once that's set up, clicking Publish will:

1. Mirror the project to a clean public copy at `{parent}\{name}-public`, excluding `.env`, secrets, `node_modules`, and build artifacts.
2. Generate `README.md`, `LICENSE` (MIT), `.gitignore`, and `.github/` issue + PR templates.
3. Run `git init`, `git commit`, and `gh repo create --public --source=. --push`.
4. Set the repo's description, homepage, and topics from `package.json`.
5. Create a `v{version}` release with auto-generated notes.

## Scripts

- `npm run server` — Start the local Express server (no Electron window)
- `npm run dev` — Run in development mode (Electron + server)
- `npm run icon` — Regenerate `assets/icon.ico` from `assets/logo.svg`
- `npm run build` — Build the NSIS Windows installer
- `npm run build:portable` — Build a single-file portable `.exe`
- `npm run build:dir` — Produce the unpacked app folder for fast iteration

## Features

- **Folder scanning** — point at any number of root folders, auto-discover projects
- **Stack auto-detection** — Next.js, React, Node API, Vite, Flutter, Python, Rust, Go, Static
- **Status board** — In Progress / On Hold / Done / Archived with custom labels and colors
- **One-click tools** — Open in VS Code, launch Claude Code, launch Codex in Windows Terminal
- **Robocopy backups** — `/MIR` to a configurable destination, with safety markers
- **Publish to GitHub** — clean public copy + `gh repo create --public --push` + repo polish + release
- **Custom branding** — replace the app logo at runtime; auto-restart applies it everywhere
- **Frameless macOS-style window** — traffic-light controls, drag region, ambient background

## Tech Stack

- [Electron](https://www.electronjs.org/) — desktop shell
- [Express](https://expressjs.com/) — in-process API for project state
- Vanilla HTML / CSS / JS frontend (no framework, no build step for the renderer)
- [Sharp](https://sharp.pixelplumbing.com/) + [png-to-ico](https://www.npmjs.com/package/png-to-ico) — icon generation
- [electron-builder](https://www.electron.build/) — NSIS Windows installer

## Contributing

Contributions, issues, and feature requests are welcome.
Open an [issue](https://github.com/cleaneramade/Coding-Drives/issues) or submit a pull request.

## License

MIT © cleaneramade — see [LICENSE](LICENSE) for details.

---

Made by [@cleaneramade](https://x.com/cleaneramade).
