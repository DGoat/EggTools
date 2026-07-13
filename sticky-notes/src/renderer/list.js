const noteList = document.getElementById('noteList');
const emptyEl = document.getElementById('empty');
const searchEl = document.getElementById('search');
const newBtn = document.getElementById('newBtn');

let allNotes = [];

function render() {
  const q = searchEl.value.trim().toLowerCase();
  const items = allNotes.filter((n) => n.title.toLowerCase().includes(q));

  noteList.innerHTML = '';
  emptyEl.hidden = allNotes.length !== 0;

  items.forEach((n) => {
    const card = document.createElement('div');
    card.className = 'note-card card-' + n.color;

    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = 'rgba(0,0,0,0.25)';

    const text = document.createElement('span');
    text.className = 'text';
    text.textContent = n.title;

    card.appendChild(dot);
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
    del.title = 'Delete';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      window.listAPI.remove(n.id);
    });
    card.appendChild(del);

    card.addEventListener('click', () => window.listAPI.open(n.id));
    noteList.appendChild(card);
  });
}

async function load() {
  allNotes = await window.listAPI.all();
  render();
}

window.listAPI.onUpdate((data) => {
  allNotes = data;
  render();
});

searchEl.addEventListener('input', render);
newBtn.addEventListener('click', () => window.listAPI.create());

load();
