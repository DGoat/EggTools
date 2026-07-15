const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile, execFileSync } = require('child_process');

const REMOTE = process.env.EGG_DATA_REMOTE || 'https://github.com/DGoat/EggNotes-data.git';
const dataDir = path.join(app.getPath('userData'), 'data-repo');
const notesFile = path.join(dataDir, 'notes.json');
const todosDir = path.join(dataDir, 'todos');

const TODO_STATUSES = ['new', 'in-progress', 'paused', 'done'];
const CARRY_STATUSES = ['new', 'in-progress'];

let notes = {};
let hasGit = false;

// ---------- Git helpers ----------
function gitSync(args) {
  return execFileSync('git', args, { cwd: dataDir, stdio: 'pipe' }).toString();
}

function ensureRepo() {
  try {
    if (fs.existsSync(path.join(dataDir, '.git'))) {
      hasGit = true;
      try {
        gitSync(['pull', '--ff-only']);
      } catch { /* offline is fine */ }
    } else {
      fs.mkdirSync(path.dirname(dataDir), { recursive: true });
      execFileSync('git', ['clone', REMOTE, dataDir], { stdio: 'pipe' });
      hasGit = true;
    }
    // ensure commit identity exists locally
    try { gitSync(['config', 'user.name']); } catch { gitSync(['config', 'user.name', 'EggTools']); }
    try { gitSync(['config', 'user.email']); } catch { gitSync(['config', 'user.email', 'eggtools@local']); }
  } catch {
    hasGit = false;
  }
  fs.mkdirSync(todosDir, { recursive: true });
  loadNotes();
}

let pushTimer = null;
let pushing = false;
let pendingMsg = null;

function syncPush(message) {
  if (!hasGit) return;
  pendingMsg = message || 'update';
  clearTimeout(pushTimer);
  pushTimer = setTimeout(runPush, 1500);
}

function runPush() {
  if (pushing || !hasGit) return;
  pushing = true;
  const msg = pendingMsg || 'update';
  execFile('git', ['add', '-A'], { cwd: dataDir }, () => {
    execFile('git', ['commit', '-m', msg], { cwd: dataDir }, () => {
      execFile('git', ['push'], { cwd: dataDir }, () => {
        pushing = false;
      });
    });
  });
}

function pullNow() {
  if (!hasGit) return;
  try {
    gitSync(['pull', '--ff-only']);
    loadNotes();
  } catch { /* ignore */ }
}

// ---------- Notes ----------
function loadNotes() {
  try {
    notes = JSON.parse(fs.readFileSync(notesFile, 'utf-8'));
  } catch {
    notes = {};
  }
}

function saveNotesFile() {
  try {
    fs.writeFileSync(notesFile, JSON.stringify(notes, null, 2));
  } catch (err) {
    console.error('save notes failed', err);
  }
  syncPush('notes: update');
}

function getNotes() {
  return notes;
}

function setNote(id, note) {
  notes[id] = note;
  saveNotesFile();
}

function patchNote(id, patch) {
  if (!notes[id]) return false;
  notes[id] = Object.assign(notes[id], patch);
  saveNotesFile();
  return true;
}

function removeNote(id) {
  delete notes[id];
  saveNotesFile();
}

// ---------- Todos ----------
function pad(n) {
  return String(n).padStart(2, '0');
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todoPath(dateStr) {
  const [y, m] = dateStr.split('-');
  return path.join(todosDir, y, m, `${dateStr}.json`);
}

function readTodoFile(dateStr) {
  try {
    return JSON.parse(fs.readFileSync(todoPath(dateStr), 'utf-8'));
  } catch {
    return null;
  }
}

function writeTodoFile(day) {
  const p = todoPath(day.date);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(day, null, 2));
  syncPush(`todos: ${day.date}`);
}

function listTodoDates() {
  const dates = [];
  let years = [];
  try { years = fs.readdirSync(todosDir); } catch { return dates; }
  years.forEach((y) => {
    const yDir = path.join(todosDir, y);
    if (!fs.statSync(yDir).isDirectory()) return;
    fs.readdirSync(yDir).forEach((m) => {
      const mDir = path.join(yDir, m);
      if (!fs.statSync(mDir).isDirectory()) return;
      fs.readdirSync(mDir).forEach((f) => {
        if (f.endsWith('.json')) dates.push(f.replace('.json', ''));
      });
    });
  });
  return dates.sort();
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Create today's file, carrying over unfinished items from the latest prior day.
function ensureToday() {
  const today = todayStr();
  if (readTodoFile(today)) return today;

  const prior = listTodoDates().filter((d) => d < today);
  const carried = [];
  if (prior.length) {
    const last = readTodoFile(prior[prior.length - 1]);
    if (last && Array.isArray(last.items)) {
      last.items
        .filter((it) => CARRY_STATUSES.includes(it.status))
        .forEach((it) => {
          carried.push({
            id: genId(),
            text: it.text,
            status: it.status,
            carriedFrom: last.date,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        });
    }
  }
  const day = { date: today, items: carried };
  writeTodoFile(day);
  return today;
}

function getDay(dateStr) {
  const day = readTodoFile(dateStr) || { date: dateStr, items: [] };
  return day;
}

function addTodo(dateStr, text) {
  const day = getDay(dateStr);
  const item = {
    id: genId(),
    text: String(text || '').trim(),
    status: 'new',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  if (!item.text) return null;
  day.items.push(item);
  writeTodoFile(day);
  return item;
}

function updateTodo(dateStr, id, patch) {
  const day = getDay(dateStr);
  const item = day.items.find((i) => i.id === id);
  if (!item) return false;
  if (patch.status && !TODO_STATUSES.includes(patch.status)) delete patch.status;
  Object.assign(item, patch, { updatedAt: Date.now() });
  writeTodoFile(day);
  return true;
}

function deleteTodo(dateStr, id) {
  const day = getDay(dateStr);
  const before = day.items.length;
  day.items = day.items.filter((i) => i.id !== id);
  if (day.items.length !== before) writeTodoFile(day);
  return true;
}

function fuzzyMatch(text, q) {
  const t = text.toLowerCase().replace(/\s+/g, '');
  const s = q.toLowerCase().replace(/\s+/g, '');
  let i = 0;
  for (const ch of t) {
    if (ch === s[i]) i++;
    if (i === s.length) return true;
  }
  return s.length === 0;
}

function searchTodos(query, mode) {
  const q = String(query || '').trim();
  if (!q) return [];
  const results = [];
  listTodoDates().forEach((date) => {
    const day = readTodoFile(date);
    if (!day || !Array.isArray(day.items)) return;
    day.items.forEach((it) => {
      const hit =
        mode === 'fuzzy'
          ? fuzzyMatch(it.text, q)
          : it.text.toLowerCase().includes(q.toLowerCase());
      if (hit) results.push({ date, item: it });
    });
  });
  return results;
}

function zeroCounts() {
  return { new: 0, 'in-progress': 0, paused: 0, done: 0 };
}

function addCounts(dst, src) {
  Object.keys(src).forEach((k) => { dst[k] = (dst[k] || 0) + src[k]; });
}

// Flatten all todos across every day: [{ date, item }]
function allTodos() {
  const res = [];
  listTodoDates().forEach((date) => {
    const day = readTodoFile(date);
    if (day && Array.isArray(day.items)) {
      day.items.forEach((item) => res.push({ date, item }));
    }
  });
  return res;
}

// Aggregate all days into year -> month -> days with per-status counts.
function summary() {
  const tree = {};
  listTodoDates().forEach((date) => {
    const day = readTodoFile(date);
    if (!day) return;
    const [y, m] = date.split('-');
    if (!tree[y]) tree[y] = { total: 0, counts: zeroCounts(), months: {} };
    if (!tree[y].months[m]) tree[y].months[m] = { total: 0, counts: zeroCounts(), days: [] };
    const c = zeroCounts();
    (day.items || []).forEach((it) => { if (c[it.status] != null) c[it.status]++; });
    const total = (day.items || []).length;
    tree[y].months[m].days.push({ date, total, counts: c });
    tree[y].months[m].total += total;
    addCounts(tree[y].months[m].counts, c);
    tree[y].total += total;
    addCounts(tree[y].counts, c);
  });
  return tree;
}

module.exports = {
  TODO_STATUSES,
  ensureRepo,
  pullNow,
  // notes
  getNotes,
  setNote,
  patchNote,
  removeNote,
  // todos
  todayStr,
  ensureToday,
  getDay,
  addTodo,
  updateTodo,
  deleteTodo,
  searchTodos,
  listTodoDates,
  summary,
  allTodos,
  genId
};
