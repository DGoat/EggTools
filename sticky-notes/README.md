# Sticky Notes

A lightweight desktop sticky notes app inspired by Windows Sticky Notes, built with Electron.

## Features

- Multiple independent, frameless note windows
- Draggable title bar, resizable windows (position/size persisted)
- 7 color themes (yellow / green / pink / purple / blue / gray / charcoal)
- Rich text formatting: **bold**, *italic*, underline, strikethrough, bullet list
- Auto-save while typing; open notes reopen on next launch
- Create (`+`) and delete notes; per-note menu
- **System tray** — app stays resident; tray menu for New Note / Notes List / Quit
- **Launch at startup** — toggle from the tray menu
- **Notes list window** — searchable overview of all notes; click to open, closed notes are kept and can be reopened

## Data

Notes are stored as JSON in Electron's `userData` directory:

- Windows: `%APPDATA%/sticky-notes/notes.json`

## Development

```bash
cd sticky-notes
npm install
npm start
```

## Project structure

```
sticky-notes/
├── package.json
├── scripts/
│   ├── start.js           # Launcher (forces GUI mode)
│   └── gen-icon.js        # Generates the tray icon
├── assets/
│   └── icon.png           # Tray / window icon
└── src/
    ├── main.js            # Main process: tray, windows, storage, IPC
    ├── preload.js         # Secure contextBridge API
    └── renderer/
        ├── index.html     # Note UI
        ├── styles.css     # Themes and layout
        ├── renderer.js    # Editing, formatting, save logic
        ├── list.html      # Notes list window
        ├── list.css       # List styling
        └── list.js        # List logic
```

## Build

Add `electron-builder` and run `npm run dist` to package a distributable.

The NSIS installer is written to `dist/Sticky Notes Setup <version>.exe`.

## Release

Publish the installer to a GitHub Release in one command:

```bash
npm run release
```

This builds the installer, then creates (or reuses) the `v<version>` release on
`DGoat/EggTools` and uploads the `.exe`. The GitHub token is taken from the
`GITHUB_TOKEN` env var, or falls back to the local Git credential store — no
secret is stored in the repo. Override the target repo with `GH_REPO=owner/name`.
