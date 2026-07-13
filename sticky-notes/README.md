# Sticky Notes

A lightweight desktop sticky notes app inspired by Windows Sticky Notes, built with Electron.

## Features

- Multiple independent, frameless note windows
- Draggable title bar, resizable windows (position/size persisted)
- 7 color themes (yellow / green / pink / purple / blue / gray / charcoal)
- Rich text formatting: **bold**, *italic*, underline, strikethrough, bullet list
- Auto-save while typing; notes reopen on next launch
- Create (`+`) and delete notes; per-note menu

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
└── src/
    ├── main.js            # Main process: windows, storage, IPC
    ├── preload.js         # Secure contextBridge API
    └── renderer/
        ├── index.html     # Note UI
        ├── styles.css     # Themes and layout
        └── renderer.js    # Editing, formatting, save logic
```

## Build

Add `electron-builder` and run `npm run dist` to package a distributable.
