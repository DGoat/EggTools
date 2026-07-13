const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notesAPI', {
  get: (id) => ipcRenderer.invoke('note:get', id),
  save: (id, patch) => ipcRenderer.invoke('note:save', { id, patch }),
  create: () => ipcRenderer.invoke('note:new'),
  open: (id) => ipcRenderer.invoke('note:open', id),
  remove: (id) => ipcRenderer.invoke('note:delete', id),
  close: (id) => ipcRenderer.invoke('note:close', id),
  colors: () => ipcRenderer.invoke('note:colors')
});

contextBridge.exposeInMainWorld('listAPI', {
  all: () => ipcRenderer.invoke('list:all'),
  create: () => ipcRenderer.invoke('list:new'),
  open: (id) => ipcRenderer.invoke('note:open', id),
  remove: (id) => ipcRenderer.invoke('note:delete', id),
  onUpdate: (cb) => ipcRenderer.on('list:update', (_e, data) => cb(data))
});

contextBridge.exposeInMainWorld('todoAPI', {
  today: () => ipcRenderer.invoke('todo:today'),
  day: (date) => ipcRenderer.invoke('todo:day', date),
  add: (date, text) => ipcRenderer.invoke('todo:add', { date, text }),
  update: (date, id, patch) => ipcRenderer.invoke('todo:update', { date, id, patch }),
  remove: (date, id) => ipcRenderer.invoke('todo:delete', { date, id }),
  search: (query, mode) => ipcRenderer.invoke('todo:search', { query, mode }),
  dates: () => ipcRenderer.invoke('todo:dates')
});
