const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notesAPI', {
  get: (id) => ipcRenderer.invoke('note:get', id),
  save: (id, patch) => ipcRenderer.invoke('note:save', { id, patch }),
  create: () => ipcRenderer.invoke('note:new'),
  remove: (id) => ipcRenderer.invoke('note:delete', id),
  close: (id) => ipcRenderer.invoke('note:close', id),
  colors: () => ipcRenderer.invoke('note:colors')
});
