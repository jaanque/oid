const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Peticiones del Renderer al Main (Invoke/Handle)
  getDirectoryContents: (directoryPath: string) => ipcRenderer.invoke('get-directory-contents', directoryPath),
  getFileContent: (filePath: string) => ipcRenderer.invoke('get-file-content', filePath),
  
  // Eventos del Main al Renderer (Send/On)
  onDirectoryOpened: (callback: (path: string) => void) => {
    ipcRenderer.on('directory-opened', (event, path) => callback(path));
  },
});