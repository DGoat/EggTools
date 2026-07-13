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
