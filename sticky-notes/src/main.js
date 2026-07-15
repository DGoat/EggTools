const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const store = require('./store');

const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
const settingsFile = path.join(app.getPath('userData'), 'settings.json');

// id -> BrowserWindow
const windows = new Map();
let listWin = null;
let tray = null;
let settings = { autoLaunch: false };

const COLORS = ['yellow', 'green', 'pink', 'purple', 'blue', 'gray', 'charcoal'];

const fs = require('fs');
function loadSettings() {
  try {
    settings = Object.assign(settings, JSON.parse(fs.readFileSync(settingsFile, 'utf-8')));
  } catch { /* defaults */ }
}
function saveSettings() {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  } catch { /* ignore */ }
}
function applyAutoLaunch() {
  app.setLoginItemSettings({ openAtLogin: !!settings.autoLaunch });
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

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'), { query: { id: note.id } });

  const persistBounds = () => {
    if (win.isDestroyed()) return;
    const notes = store.getNotes();
    if (notes[note.id]) store.patchNote(note.id, { bounds: win.getBounds() });
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
  const id = store.genId();
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
  store.setNote(id, note);
  createNoteWindow(note);
  refreshList();
  return note;
}

function openNote(id) {
  const notes = store.getNotes();
  if (!notes[id]) return;
  store.patchNote(id, { open: true });
  createNoteWindow(notes[id]);
  refreshList();
}

function hideNote(id) {
  const notes = store.getNotes();
  if (notes[id]) store.patchNote(id, { open: false });
  const w = windows.get(id);
  if (w && !w.isDestroyed()) w.close();
  refreshList();
}

function deleteNote(id) {
  store.removeNote(id);
  const w = windows.get(id);
  if (w && !w.isDestroyed()) w.close();
  refreshList();
}

// ---- Overview window (Notes + Todos tabs) ----
function createListWindow() {
  if (listWin && !listWin.isDestroyed()) {
    listWin.show();
    listWin.focus();
    return;
  }
  listWin = new BrowserWindow({
    width: 340,
    height: 520,
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
  listWin.on('closed', () => { listWin = null; });
}

function getNoteSummaries() {
  return Object.values(store.getNotes()).map((n) => ({
    id: n.id,
    title: noteTitle(n),
    color: n.color || 'yellow',
    open: windows.has(n.id)
  }));
}

function refreshList() {
  if (listWin && !listWin.isDestroyed()) {
    listWin.webContents.send('list:update', getNoteSummaries());
  }
}

// ---- Tray ----
function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'New Note', click: () => newNote() },
    { label: 'Overview', click: () => createListWindow() },
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
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
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
    store.ensureRepo();
    store.ensureToday();
    loadSettings();
    applyAutoLaunch();
    createTray();

    const notes = store.getNotes();
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

// ---- Note IPC ----
ipcMain.handle('note:get', (_e, id) => store.getNotes()[id] || null);
ipcMain.handle('note:save', (_e, { id, patch }) => {
  const ok = store.patchNote(id, patch);
  refreshList();
  return ok;
});
ipcMain.handle('note:new', () => newNote().id);
ipcMain.handle('note:open', (_e, id) => openNote(id));
ipcMain.handle('note:delete', (_e, id) => deleteNote(id));
ipcMain.handle('note:close', (_e, id) => hideNote(id));
ipcMain.handle('note:colors', () => COLORS);

// ---- List IPC ----
ipcMain.handle('list:all', () => getNoteSummaries());
ipcMain.handle('list:new', () => newNote().id);

// ---- Todo IPC ----
ipcMain.handle('todo:today', () => store.ensureToday());
ipcMain.handle('todo:day', (_e, dateStr) => store.getDay(dateStr));
ipcMain.handle('todo:add', (_e, { date, text }) => store.addTodo(date, text));
ipcMain.handle('todo:update', (_e, { date, id, patch }) => store.updateTodo(date, id, patch));
ipcMain.handle('todo:delete', (_e, { date, id }) => store.deleteTodo(date, id));
ipcMain.handle('todo:search', (_e, { query, mode }) => store.searchTodos(query, mode));
ipcMain.handle('todo:dates', () => store.listTodoDates());
ipcMain.handle('todo:summary', () => store.summary());
ipcMain.handle('todo:all', () => store.allTodos());

// Keep app resident in tray
app.on('window-all-closed', () => { /* no-op */ });
