const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  getDeviceId: () => ipcRenderer.invoke('get-device-id'),
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  downloadPdf: (payload) => ipcRenderer.invoke('download-pdf', payload),
  showInFolder: (path) => ipcRenderer.invoke('show-in-folder', path),
});
