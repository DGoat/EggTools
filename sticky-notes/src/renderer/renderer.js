const noteId = new URLSearchParams(location.search).get('id');

const COLOR_HEX = {
  yellow: '#fdf6a8',
  green: '#d3f7c4',
  pink: '#ffd6e0',
  purple: '#e4d4ff',
  blue: '#cfecff',
  gray: '#e9e9e9',
  charcoal: '#3a3a3a'
};

const editor = document.getElementById('editor');
const titlebar = document.getElementById('titlebar');
const addBtn = document.getElementById('addBtn');
const menuBtn = document.getElementById('menuBtn');
const closeBtn = document.getElementById('closeBtn');
const menuPanel = document.getElementById('menuPanel');
const colorRow = document.getElementById('colorRow');
const deleteBtn = document.getElementById('deleteBtn');
const toolbar = document.getElementById('toolbar');

let saveTimer = null;

function applyTheme(color) {
  document.body.className = 'theme-' + color;
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    window.notesAPI.save(noteId, { content: editor.innerHTML });
  }, 400);
}

async function init() {
  const note = await window.notesAPI.get(noteId);
  if (note) {
    editor.innerHTML = note.content || '';
    applyTheme(note.color || 'yellow');
  }

  const colors = await window.notesAPI.colors();
  colors.forEach((c) => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = COLOR_HEX[c] || '#ffffff';
    sw.title = c;
    if (note && note.color === c) sw.classList.add('active');
    sw.addEventListener('click', () => {
      applyTheme(c);
      window.notesAPI.save(noteId, { color: c });
      colorRow.querySelectorAll('.swatch').forEach((s) => s.classList.remove('active'));
      sw.classList.add('active');
    });
    colorRow.appendChild(sw);
  });
}

// Editing
editor.addEventListener('input', scheduleSave);
editor.addEventListener('blur', () => {
  window.notesAPI.save(noteId, { content: editor.innerHTML });
});

// Toolbar formatting
toolbar.addEventListener('mousedown', (e) => {
  const btn = e.target.closest('.fmt-btn');
  if (!btn) return;
  e.preventDefault();
  document.execCommand(btn.dataset.cmd, false, null);
  editor.focus();
  updateToolbarState();
  scheduleSave();
});

function updateToolbarState() {
  document.querySelectorAll('.fmt-btn').forEach((btn) => {
    const cmd = btn.dataset.cmd;
    let active = false;
    try {
      active = document.queryCommandState(cmd);
    } catch {
      active = false;
    }
    btn.classList.toggle('active', active);
  });
}

document.addEventListener('selectionchange', updateToolbarState);

// Title bar actions
addBtn.addEventListener('click', () => window.notesAPI.create());
document.getElementById('minBtn').addEventListener('click', () => window.winCtl.minimize());
closeBtn.addEventListener('click', () => {
  window.notesAPI.save(noteId, { content: editor.innerHTML });
  window.notesAPI.close(noteId);
});

menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  menuPanel.hidden = !menuPanel.hidden;
});

document.addEventListener('click', () => {
  menuPanel.hidden = true;
});
menuPanel.addEventListener('click', (e) => e.stopPropagation());

deleteBtn.addEventListener('click', () => {
  window.notesAPI.remove(noteId);
});

init();
