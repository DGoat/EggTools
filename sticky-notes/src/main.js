const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const dataFile = path.join(app.getPath('userData'), 'notes.json');

// id -> note object { id, content, color, bounds }
let notes = {};
// id -> BrowserWindow
const windows = new Map();

const COLORS = ['yellow', 'green', 'pink', 'purple', 'blue', 'gray', 'charcoal'];

function loadNotes() {
  try {
    notes = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  } catch {
    notes = {};
  }
}

function saveNotes() {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(notes, null, 2));
  } catch (err) {
    console.error('Failed to save notes:', err);
  }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function createNoteWindow(note) {
  const b = note.bounds || {};
  const win = new BrowserWindow({
    width: b.width || 320,
    height: b.height || 300,
    x: b.x,
    y: b.y,
    frame: false,
    minWidth: 220,
    minHeight: 160,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
    query: { id: note.id }
  });

  const persistBounds = () => {
    if (win.isDestroyed()) return;
    if (notes[note.id]) {
      notes[note.id].bounds = win.getBounds();
      saveNotes();
    }
  };
  win.on('resize', persistBounds);
  win.on('move', persistBounds);
  win.on('closed', () => windows.delete(note.id));

  windows.set(note.id, win);
  return win;
}

function newNote() {
  const id = genId();
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const offset = Math.floor(Math.random() * 40);
  const note = {
    id,
    content: '',
    color: 'yellow',
    bounds: {
      x: display.workArea.x + 120 + offset,
      y: display.workArea.y + 120 + offset,
      width: 320,
      height: 300
    }
  };
  notes[id] = note;
  saveNotes();
  createNoteWindow(note);
  return note;
}

app.whenReady().then(() => {
  loadNotes();
  const ids = Object.keys(notes);
  if (ids.length === 0) {
    newNote();
  } else {
    ids.forEach((id) => createNoteWindow(notes[id]));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) newNote();
  });
});

ipcMain.handle('note:get', (_e, id) => notes[id] || null);

ipcMain.handle('note:save', (_e, { id, patch }) => {
  if (!notes[id]) return false;
  notes[id] = Object.assign(notes[id], patch);
  saveNotes();
  return true;
});

ipcMain.handle('note:new', () => {
  const note = newNote();
  return note.id;
});

ipcMain.handle('note:delete', (_e, id) => {
  delete notes[id];
  saveNotes();
  const w = windows.get(id);
  if (w && !w.isDestroyed()) w.close();
  return true;
});

ipcMain.handle('note:close', (_e, id) => {
  const w = windows.get(id);
  if (w && !w.isDestroyed()) w.close();
  return true;
});

ipcMain.handle('note:colors', () => COLORS);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
