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
  showDayView();
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

  const editable = document.createElement('span');
  editable.className = 'todo-edit';
  editable.contentEditable = 'true';
  editable.spellcheck = false;
  editable.textContent = it.text;
  editable.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); editable.blur(); }
  });
  editable.addEventListener('blur', async () => {
    const v = editable.textContent.trim();
    if (v && v !== it.text) {
      it.text = v;
      await window.todoAPI.update(date, it.id, { text: v });
    } else {
      editable.textContent = it.text;
    }
  });
  text.appendChild(editable);

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
  const applySelColor = () => { sel.className = 'status-sel status-' + sel.value; };
  Object.keys(STATUS_LABELS).forEach((s) => {
    const o = document.createElement('option');
    o.value = s;
    o.textContent = STATUS_LABELS[s];
    if (s === it.status) o.selected = true;
    sel.appendChild(o);
  });
  applySelColor();
  sel.addEventListener('change', async () => {
    applySelColor();
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

// ---------- Summary (filterable table) ----------
const summaryView = document.getElementById('summaryView');
const summaryBtn = document.getElementById('summaryBtn');
const todoAddRow = document.getElementById('todoAddRow');
const todoSearchRow = document.getElementById('todoSearchRow');
const dayNavBtns = [
  document.getElementById('prevDay'),
  document.getElementById('nextDay'),
  document.getElementById('todayBtn')
];
let summaryMode = false;
const STATUS_KEYS = ['new', 'in-progress', 'paused', 'done'];

// table filter state
let tblAll = [];
let tblMonth = 'all';
let tblStatus = 'all';
let tblKeyword = '';
let tblSort = 'date-desc';

function showDayView() {
  summaryMode = false;
  summaryView.hidden = true;
  todoList.hidden = false;
  todoAddRow.hidden = false;
  todoSearchRow.hidden = false;
  dayNavBtns.forEach((b) => (b.style.display = ''));
}

async function renderSummary() {
  summaryMode = true;
  clearSearch();
  todoList.hidden = true;
  todoEmpty.hidden = true;
  todoAddRow.hidden = true;
  todoSearchRow.hidden = true;
  dayNavBtns.forEach((b) => (b.style.display = 'none'));
  summaryView.hidden = false;
  dateLabel.textContent = '待办总表';

  tblAll = await window.todoAPI.all();
  buildTableShell();
  renderTableRows();
}

function distinctMonths() {
  const set = new Set();
  tblAll.forEach((r) => set.add(r.date.slice(0, 7)));
  return Array.from(set).sort().reverse();
}

function buildTableShell() {
  summaryView.innerHTML = '';

  const bar = document.createElement('div');
  bar.className = 'tbl-filters';

  const monthSel = document.createElement('select');
  monthSel.innerHTML = '<option value="all">全部月份</option>';
  distinctMonths().forEach((m) => {
    const o = document.createElement('option');
    o.value = m;
    o.textContent = m;
    if (m === tblMonth) o.selected = true;
    monthSel.appendChild(o);
  });
  monthSel.addEventListener('change', () => { tblMonth = monthSel.value; renderTableRows(); });

  const statusSel = document.createElement('select');
  statusSel.innerHTML = '<option value="all">全部状态</option>';
  STATUS_KEYS.forEach((s) => {
    const o = document.createElement('option');
    o.value = s;
    o.textContent = STATUS_LABELS[s];
    if (s === tblStatus) o.selected = true;
    statusSel.appendChild(o);
  });
  statusSel.addEventListener('change', () => { tblStatus = statusSel.value; renderTableRows(); });

  const kw = document.createElement('input');
  kw.type = 'text';
  kw.placeholder = '关键词...';
  kw.value = tblKeyword;
  kw.addEventListener('input', () => { tblKeyword = kw.value; renderTableRows(); });

  bar.appendChild(monthSel);
  bar.appendChild(statusSel);
  bar.appendChild(kw);
  summaryView.appendChild(bar);

  const table = document.createElement('table');
  table.className = 'tbl';
  const thead = document.createElement('thead');
  thead.innerHTML =
    '<tr><th class="th-date" data-sort="date">日期</th><th>内容</th><th class="th-status">状态</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  tbody.id = 'tblBody';
  table.appendChild(tbody);
  summaryView.appendChild(table);

  thead.querySelector('.th-date').addEventListener('click', () => {
    tblSort = tblSort === 'date-desc' ? 'date-asc' : 'date-desc';
    renderTableRows();
  });

  const count = document.createElement('div');
  count.className = 'tbl-count';
  count.id = 'tblCount';
  summaryView.appendChild(count);
}

function renderTableRows() {
  const kw = tblKeyword.trim().toLowerCase();
  let rows = tblAll.filter((r) => {
    if (tblMonth !== 'all' && r.date.slice(0, 7) !== tblMonth) return false;
    if (tblStatus !== 'all' && r.item.status !== tblStatus) return false;
    if (kw && !r.item.text.toLowerCase().includes(kw)) return false;
    return true;
  });
  rows.sort((a, b) =>
    tblSort === 'date-asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
  );

  const tbody = document.getElementById('tblBody');
  tbody.innerHTML = '';
  rows.forEach((r) => {
    const tr = document.createElement('tr');

    const tdDate = document.createElement('td');
    tdDate.className = 'td-date';
    tdDate.textContent = r.date;
    tdDate.title = '跳到当天';
    tdDate.addEventListener('click', () => { currentDate = r.date; renderDay(); });

    const tdText = document.createElement('td');
    tdText.className = 'td-text';
    const ed = document.createElement('span');
    ed.className = 'todo-edit';
    ed.contentEditable = 'true';
    ed.spellcheck = false;
    ed.textContent = r.item.text;
    ed.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ed.blur(); } });
    ed.addEventListener('blur', async () => {
      const v = ed.textContent.trim();
      if (v && v !== r.item.text) {
        r.item.text = v;
        await window.todoAPI.update(r.date, r.item.id, { text: v });
      } else {
        ed.textContent = r.item.text;
      }
    });
    tdText.appendChild(ed);

    const tdStatus = document.createElement('td');
    const sel = document.createElement('select');
    const applyColor = () => { sel.className = 'status-sel status-' + sel.value; };
    STATUS_KEYS.forEach((s) => {
      const o = document.createElement('option');
      o.value = s;
      o.textContent = STATUS_LABELS[s];
      if (s === r.item.status) o.selected = true;
      sel.appendChild(o);
    });
    applyColor();
    sel.addEventListener('change', async () => {
      applyColor();
      r.item.status = sel.value;
      await window.todoAPI.update(r.date, r.item.id, { status: sel.value });
      if (tblStatus !== 'all') renderTableRows();
    });
    tdStatus.appendChild(sel);

    tr.appendChild(tdDate);
    tr.appendChild(tdText);
    tr.appendChild(tdStatus);
    tbody.appendChild(tr);
  });

  document.getElementById('tblCount').textContent = `${rows.length} 条`;
}

summaryBtn.addEventListener('click', () => {
  if (summaryMode) renderDay();
  else renderSummary();
});

// initial
loadNotes();
