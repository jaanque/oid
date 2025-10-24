const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Peticiones del Renderer al Main (Invoke/Handle)
  getDirectoryContents: (directoryPath: string) => ipcRenderer.invoke('get-directory-contents', directoryPath),
  getFileContent: (filePath: string) => ipcRenderer.invoke('get-file-content', filePath),
  saveFile: (filePath: string, content: string) => ipcRenderer.invoke('save-file', { filePath, content }),
  createFile: (filePath: string) => ipcRenderer.invoke('create-file', filePath),
  createDirectory: (dirPath: string) => ipcRenderer.invoke('create-directory', dirPath),

  // Eventos del Main al Renderer (Send/On)
  onDirectoryOpened: (callback: (path: string) => void) => {
    ipcRenderer.on('directory-opened', (event, path) => callback(path));
  },
  onSaveFileRequest: (callback: () => void) => {
    ipcRenderer.on('save-file-request', () => callback());
  },
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  onContextMenuCommand: (callback: (command: string) => void) => {
    ipcRenderer.on('context-menu-command', (event, command) => callback(command));
  },
});