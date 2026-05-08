<div align="center">

# Coding Drives

The fastest way to track every coding project on your PC — a native Windows desktop app that turns your projects folder into a clickable dashboard.

[![License: MIT](https://img.shields.io/badge/License-MIT-6a4dff.svg)](LICENSE) ![Version](https://img.shields.io/badge/version-1.2.8-1f1f23.svg) [![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078d6.svg)](#) [![Built with Electron](https://img.shields.io/badge/built%20with-Electron-47848F.svg)](https://www.electronjs.org/)

</div>

---

## Overview

Coding Drives is a local-first project dashboard for developers who live in their `~/Documents` folder. Point it at any number of root folders, and every subfolder becomes a card — auto-detected stack (Next.js, React, Node, Python, Rust, Flutter, Go, Static), status workflow, one-click open in **VS Code**, **Claude Code**, or **Codex**, safe robocopy backups, and a one-click **Publish to GitHub** flow that mirrors the project to a clean public copy, generates README + LICENSE + issue templates, and pushes it to a polished public repo with a release.

Built specifically for the AI-era development workflow where projects multiply faster than you can name them.

## Installation

```bash
git clone https://github.com/cleaneramade/Coding-Drives.git
cd Coding-Drives
npm install
```

## Usage

Launch the desktop app from source:

```bash
npm run dev
```

Or build a Windows installer:

```bash
npm run build
```

The installer lands in `dist/Coding Drives Setup 1.2.8.exe`.

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
