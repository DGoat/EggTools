// ---------- Tabs ----------
const tabs = document.querySelectorAll('.tab');
const panels = {
  notes: document.getElementById('panel-notes'),
  todos: document.getElementById('panel-todos')
};
tabs.forEach((t) => {
  t.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    Object.entries(panels).forEach(([k, p]) => {
      const on = k === t.dataset.tab;
      p.classList.toggle('active', on);
      p.hidden = !on;
    });
    if (t.dataset.tab === 'todos') loadTodos();
  });
});

document.getElementById('closeWin').addEventListener('click', () => window.close());

// ---------- Notes tab ----------
const noteList = document.getElementById('noteList');
const noteEmpty = document.getElementById('noteEmpty');
const noteSearch = document.getElementById('noteSearch');
let allNotes = [];

function renderNotes() {
  const q = noteSearch.value.trim().toLowerCase();
  const items = allNotes.filter((n) => n.title.toLowerCase().includes(q));
  noteList.innerHTML = '';
  noteEmpty.hidden = allNotes.length !== 0;
  items.forEach((n) => {
    const card = document.createElement('div');
    card.className = 'note-card card-' + n.color;
    const text = document.createElement('span');
    text.className = 'text';
    text.textContent = n.title;
    card.appendChild(text);
    if (n.open) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'open';
      card.appendChild(badge);
    }
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '\u2715';
    del.addEventListener('click', (e) => { e.stopPropagation(); window.listAPI.remove(n.id); });
    card.appendChild(del);
    card.addEventListener('click', () => window.listAPI.open(n.id));
    noteList.appendChild(card);
  });
}

async function loadNotes() {
  allNotes = await window.listAPI.all();
  renderNotes();
}
window.listAPI.onUpdate((data) => { allNotes = data; renderNotes(); });
noteSearch.addEventListener('input', renderNotes);
document.getElementById('newNoteBtn').addEventListener('click', () => window.listAPI.create());

// ---------- Todos tab ----------
const STATUS_LABELS = {
  new: '新建',
  'in-progress': '进行中',
  paused: '暂停',
  done: '已完成'
};

const dateLabel = document.getElementById('dateLabel');
const todoList = document.getElementById('todoList');
const todoEmpty = document.getElementById('todoEmpty');
const todoInput = document.getElementById('todoInput');
const todoSearch = document.getElementById('todoSearch');
const searchMode = document.getElementById('searchMode');

let currentDate = null;

function shiftDate(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

async function loadTodos() {
  if (!currentDate) currentDate = await window.todoAPI.today();
  renderDay();
}

async function renderDay() {
  dateLabel.textContent = currentDate;
  const day = await window.todoAPI.day(currentDate);
  const items = day.items || [];
  todoList.innerHTML = '';
  todoEmpty.hidden = items.length !== 0;
  items.forEach((it) => todoList.appendChild(buildTodoRow(it, currentDate)));
}

function buildTodoRow(it, date, resultDate) {
  const row = document.createElement('div');
  row.className = 'todo-item status-' + it.status;

  const text = document.createElement('span');
  text.className = 'todo-text';
  text.textContent = it.text;
  if (it.carriedFrom) {
    const c = document.createElement('span');
    c.className = 'carried';
    c.textContent = '\u21b3' + it.carriedFrom;
    text.appendChild(c);
  }
  if (resultDate) {
    const dspan = document.createElement('span');
    dspan.className = 'search-result-date';
    dspan.textContent = resultDate;
    text.appendChild(dspan);
  }
  row.appendChild(text);

  const sel = document.createElement('select');
  Object.keys(STATUS_LABELS).forEach((s) => {
    const o = document.createElement('option');
    o.value = s;
    o.textContent = STATUS_LABELS[s];
    if (s === it.status) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', async () => {
    await window.todoAPI.update(date, it.id, { status: sel.value });
    if (!resultDate) renderDay(); else runTodoSearch();
  });
  row.appendChild(sel);

  const del = document.createElement('button');
  del.className = 'del';
  del.textContent = '\u2715';
  del.addEventListener('click', async () => {
    await window.todoAPI.remove(date, it.id);
    if (!resultDate) renderDay(); else runTodoSearch();
  });
  row.appendChild(del);

  return row;
}

async function addTodo() {
  const text = todoInput.value.trim();
  if (!text) return;
  await window.todoAPI.add(currentDate, text);
  todoInput.value = '';
  renderDay();
}

document.getElementById('addTodoBtn').addEventListener('click', addTodo);
todoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTodo(); });

document.getElementById('prevDay').addEventListener('click', () => {
  currentDate = shiftDate(currentDate, -1);
  clearSearch();
  renderDay();
});
document.getElementById('nextDay').addEventListener('click', () => {
  currentDate = shiftDate(currentDate, 1);
  clearSearch();
  renderDay();
});
document.getElementById('todayBtn').addEventListener('click', async () => {
  currentDate = await window.todoAPI.today();
  clearSearch();
  renderDay();
});

function clearSearch() {
  todoSearch.value = '';
}

let searchTimer = null;
async function runTodoSearch() {
  const q = todoSearch.value.trim();
  if (!q) { renderDay(); return; }
  const results = await window.todoAPI.search(q, searchMode.value);
  todoList.innerHTML = '';
  todoEmpty.hidden = results.length !== 0;
  dateLabel.textContent = `搜索: ${results.length} 条`;
  results.forEach((r) => todoList.appendChild(buildTodoRow(r.item, r.date, r.date)));
}
todoSearch.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runTodoSearch, 250);
});
searchMode.addEventListener('change', runTodoSearch);

// initial
loadNotes();
