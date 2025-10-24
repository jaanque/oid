const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Peticiones del Renderer al Main (Invoke/Handle)
  getDirectoryContents: (directoryPath: string) => ipcRenderer.invoke('get-directory-contents', directoryPath),
  getFileContent: (filePath: string) => ipcRenderer.invoke('get-file-content', filePath),
  saveFile: (filePath: string, content: string) => ipcRenderer.invoke('save-file', { filePath, content }),

  // Eventos del Main al Renderer (Send/On)
  onDirectoryOpened: (callback: (path: string) => void) => {
    ipcRenderer.on('directory-opened', (event, path) => callback(path));
  },
  onSaveFileRequest: (callback: () => void) => {
    ipcRenderer.on('save-file-request', () => callback());
  },
});