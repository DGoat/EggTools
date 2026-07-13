const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const dataFile = path.join(app.getPath('userData'), 'notes.json');
const settingsFile = path.join(app.getPath('userData'), 'settings.json');
const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');

// id -> note object { id, content, color, bounds, open }
let notes = {};
// id -> BrowserWindow
const windows = new Map();
let listWin = null;
let tray = null;
let settings = { autoLaunch: false };

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

function loadSettings() {
  try {
    settings = Object.assign(settings, JSON.parse(fs.readFileSync(settingsFile, 'utf-8')));
  } catch {
    // keep defaults
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

function applyAutoLaunch() {
  app.setLoginItemSettings({ openAtLogin: !!settings.autoLaunch });
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function noteTitle(note) {
  const text = (note.content || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
  return text.split('\n')[0].slice(0, 40) || 'Empty note';
}

function createNoteWindow(note) {
  if (windows.has(note.id)) {
    const w = windows.get(note.id);
    if (!w.isDestroyed()) {
      w.show();
      w.focus();
      return w;
    }
  }
  const b = note.bounds || {};
  const win = new BrowserWindow({
    width: b.width || 320,
    height: b.height || 300,
    x: b.x,
    y: b.y,
    frame: false,
    minWidth: 220,
    minHeight: 160,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    icon: iconPath,
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
  win.on('closed', () => {
    windows.delete(note.id);
    refreshList();
  });

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
    open: true,
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
  refreshList();
  return note;
}

function openNote(id) {
  if (!notes[id]) return;
  notes[id].open = true;
  saveNotes();
  createNoteWindow(notes[id]);
  refreshList();
}

function hideNote(id) {
  if (notes[id]) {
    notes[id].open = false;
    saveNotes();
  }
  const w = windows.get(id);
  if (w && !w.isDestroyed()) w.close();
  refreshList();
}

function deleteNote(id) {
  delete notes[id];
  saveNotes();
  const w = windows.get(id);
  if (w && !w.isDestroyed()) w.close();
  refreshList();
}

// ---- List window ----
function createListWindow() {
  if (listWin && !listWin.isDestroyed()) {
    listWin.show();
    listWin.focus();
    return;
  }
  listWin = new BrowserWindow({
    width: 300,
    height: 460,
    frame: false,
    skipTaskbar: false,
    icon: iconPath,
    title: 'Sticky Notes',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  listWin.loadFile(path.join(__dirname, 'renderer', 'list.html'));
  listWin.on('closed', () => {
    listWin = null;
  });
}

function refreshList() {
  if (listWin && !listWin.isDestroyed()) {
    listWin.webContents.send('list:update', getNoteSummaries());
  }
}

function getNoteSummaries() {
  return Object.values(notes).map((n) => ({
    id: n.id,
    title: noteTitle(n),
    color: n.color || 'yellow',
    open: windows.has(n.id)
  }));
}

// ---- Tray ----
function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'New Note', click: () => newNote() },
    { label: 'Notes List', click: () => createListWindow() },
    { type: 'separator' },
    {
      label: 'Launch at Startup',
      type: 'checkbox',
      checked: !!settings.autoLaunch,
      click: (item) => {
        settings.autoLaunch = item.checked;
        saveSettings();
        applyAutoLaunch();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
}

function createTray() {
  let img = nativeImage.createFromPath(iconPath);
  if (img.isEmpty()) img = nativeImage.createEmpty();
  tray = new Tray(img);
  tray.setToolTip('Sticky Notes');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => createListWindow());
}

// Single instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => createListWindow());

  app.whenReady().then(() => {
    loadNotes();
    loadSettings();
    applyAutoLaunch();
    createTray();

    const openIds = Object.keys(notes).filter((id) => notes[id].open !== false);
    if (Object.keys(notes).length === 0) {
      newNote();
    } else if (openIds.length === 0) {
      createListWindow();
    } else {
      openIds.forEach((id) => createNoteWindow(notes[id]));
    }

    app.on('activate', () => createListWindow());
  });
}

ipcMain.handle('note:get', (_e, id) => notes[id] || null);

ipcMain.handle('note:save', (_e, { id, patch }) => {
  if (!notes[id]) return false;
  notes[id] = Object.assign(notes[id], patch);
  saveNotes();
  refreshList();
  return true;
});

ipcMain.handle('note:new', () => newNote().id);
ipcMain.handle('note:open', (_e, id) => openNote(id));
ipcMain.handle('note:delete', (_e, id) => deleteNote(id));
ipcMain.handle('note:close', (_e, id) => hideNote(id));
ipcMain.handle('note:colors', () => COLORS);

// List IPC
ipcMain.handle('list:all', () => getNoteSummaries());
ipcMain.handle('list:new', () => newNote().id);

// Prevent quitting when all note windows are closed (tray keeps app alive)
app.on('window-all-closed', () => {
  // no-op: app stays in tray until explicitly quit
});
