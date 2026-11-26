// Ponte segura entre a interface e o sistema de arquivos.
// A interface só enxerga estas funções, nunca o Node diretamente.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('plannote', {
  platform: process.platform,

  loadAll: () => ipcRenderer.invoke('data:loadAll'),
  saveNotebook: (nb) => ipcRenderer.invoke('data:saveNotebook', nb),
  deleteNotebook: (id) => ipcRenderer.invoke('data:deleteNotebook', id),
  savePage: (notebookId, page) => ipcRenderer.invoke('data:savePage', notebookId, page),
  deletePage: (notebookId, pageId) => ipcRenderer.invoke('data:deletePage', notebookId, pageId),
  saveExams: (exams) => ipcRenderer.invoke('data:saveExams', exams),

  getConfig: () => ipcRenderer.invoke('config:get'),
  setWelcomed: () => ipcRenderer.invoke('config:setWelcomed'),
  openDataDir: () => ipcRenderer.invoke('config:openDataDir'),
  chooseDataDir: () => ipcRenderer.invoke('config:chooseDataDir'),

  onMenu: (handler) => ipcRenderer.on('menu', (_e, action) => handler(action)),
  onFlush: (handler) =>
    ipcRenderer.on('app:flush', async () => {
      try {
        await handler();
      } finally {
        ipcRenderer.send('app:flushed');
      }
    }),
});
