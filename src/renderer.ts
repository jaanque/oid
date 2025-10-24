import './index.css';
import * as monaco from 'monaco-editor';
import path from 'node:path';

// --- Configuración del Entorno de Monaco ---
monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
  target: monaco.languages.typescript.ScriptTarget.ES2020,
  allowNonTsExtensions: true,
  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  module: monaco.languages.typescript.ModuleKind.CommonJS,
  noEmit: true,
  lib: ['es2020'],
});

// --- Tipos y Declaraciones Globales ---
declare global {
  interface Window {
    electronAPI: {
      getDirectoryContents: (directoryPath: string) => Promise<{ name: string; isDirectory: boolean }[]>;
      getFileContent: (filePath: string) => Promise<string>;
      saveFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
      createFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      createDirectory: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
      onDirectoryOpened: (callback: (path: string) => void) => void;
      onSaveFileRequest: (callback: () => void) => void;
      showContextMenu: () => void;
      onContextMenuCommand: (callback: (command: string) => void) => void;
    };
  }
}

// --- Elementos del DOM y Estado Global ---
const editorElement = document.getElementById('editor-container');
const fileExplorerElement = document.getElementById('file-explorer');
const tabsContainerElement = document.getElementById('tabs-container');

let editor: monaco.editor.IStandaloneCodeEditor | undefined;
const openFiles = new Map<string, monaco.editor.ITextModel>();
let activeFile: string | null = null;
let currentRootPath = '';
let contextMenuTargetPath = '';

// --- Inicialización del Editor ---
if (editorElement) {
  editor = monaco.editor.create(editorElement, {
    value: `// Usa el menú "File > Abrir Directorio..." para empezar a trabajar.`,
    language: 'plaintext',
    theme: 'vs-dark',
    automaticLayout: true,
  });
}

// --- Lógica de Notificaciones ---
function showNotification(message: string, duration = 3000) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.remove();
  }, duration);
}

// --- Icon Mapping ---
const iconMap: { [key: string]: string } = {
  js: 'codicon-javascript',
  ts: 'codicon-typescript',
  css: 'codicon-css',
  html: 'codicon-html',
  json: 'codicon-json',
  md: 'codicon-markdown',
  default: 'codicon-file',
  folder: 'codicon-folder',
  folderExpanded: 'codicon-folder-opened',
};

function getIconClass(fileName: string, isDirectory: boolean, isExpanded = false) {
  if (isDirectory) {
    return isExpanded ? iconMap.folderExpanded : iconMap.folder;
  }
  const extension = path.extname(fileName).substring(1);
  return iconMap[extension] || iconMap.default;
}

// --- Lógica de Pestañas ---
function renderTabs() {
  if (!tabsContainerElement) return;
  tabsContainerElement.innerHTML = '';
  openFiles.forEach((_, filePath) => {
    const tabElement = document.createElement('div');
    tabElement.className = `tab-item ${filePath === activeFile ? 'active' : ''}`;
    tabElement.dataset.filePath = filePath;
    const iconClass = getIconClass(path.basename(filePath), false);
    tabElement.innerHTML = `<i class="codicon ${iconClass} file-icon"></i> <span>${path.basename(filePath)}</span>`;
    const closeBtn = document.createElement('span');
    closeBtn.textContent = 'x';
    closeBtn.className = 'tab-close-btn';
    tabElement.appendChild(closeBtn);
    tabsContainerElement.appendChild(tabElement);
  });
}
function switchToFile(filePath: string | null) {
  document.querySelector('.file-item.active')?.classList.remove('active');
  if (filePath && openFiles.has(filePath)) {
    activeFile = filePath;
    editor?.setModel(openFiles.get(filePath)!);
    document.querySelector(`[data-path="${filePath}"]`)?.classList.add('active');
  } else {
    activeFile = null;
    editor?.setModel(null);
  }
  renderTabs();
}
function closeFile(filePath: string) {
  const model = openFiles.get(filePath);
  if (model) model.dispose();
  openFiles.delete(filePath);
  if (activeFile === filePath) {
    const nextFile = openFiles.keys().next().value || null;
    switchToFile(nextFile);
  } else {
    renderTabs();
  }
}
tabsContainerElement?.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const tabElement = target.closest('.tab-item');
  if (!tabElement) return;
  const filePath = tabElement.dataset.filePath!;
  if (target.classList.contains('tab-close-btn')) {
    closeFile(filePath);
  } else {
    switchToFile(filePath);
  }
});

// --- Lógica del Explorador de Archivos ---
async function openFile(filePath: string) {
  if (openFiles.has(filePath)) {
    switchToFile(filePath);
    return;
  }
  const content = await window.electronAPI.getFileContent(filePath);
  const fileExtension = path.extname(filePath).substring(1);
  const model = monaco.editor.createModel(content, fileExtension);
  openFiles.set(filePath, model);
  switchToFile(filePath);
}
function createTreeItem(item: { name: string; isDirectory: boolean }, parentPath: string) {
  const fullPath = path.join(parentPath, item.name);
  const itemElement = document.createElement('div');
  itemElement.className = 'file-item';
  itemElement.dataset.path = fullPath;
  itemElement.dataset.isDirectory = String(item.isDirectory);

  const iconClass = getIconClass(item.name, item.isDirectory);
  itemElement.innerHTML = `<i class="codicon ${iconClass} file-icon"></i> <span>${item.name}</span>`;

  itemElement.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (item.isDirectory) {
      const isExpanded = itemElement.classList.contains('expanded');
      const iconElement = itemElement.querySelector('.codicon');
      if (isExpanded) {
        itemElement.classList.remove('expanded');
        if (iconElement) iconElement.className = `codicon ${getIconClass(item.name, true, false)} file-icon`;
        const childrenContainer = itemElement.querySelector('.children');
        if (childrenContainer) itemElement.removeChild(childrenContainer);
      } else {
        itemElement.classList.add('expanded');
        if (iconElement) iconElement.className = `codicon ${getIconClass(item.name, true, true)} file-icon`;
        const children = await window.electronAPI.getDirectoryContents(fullPath);
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'children';
        children.sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name))
                .forEach(child => childrenContainer.appendChild(createTreeItem(child, fullPath)));
        itemElement.appendChild(childrenContainer);
      }
    } else {
      openFile(fullPath);
    }
  });
  itemElement.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    contextMenuTargetPath = fullPath;
    window.electronAPI.showContextMenu();
  });
  return itemElement;
}
async function loadFileTree(directoryPath: string) {
  if (!fileExplorerElement) return;
  currentRootPath = directoryPath;
  fileExplorerElement.innerHTML = `<h2>${path.basename(directoryPath)}</h2>`;
  fileExplorerElement.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    contextMenuTargetPath = currentRootPath;
    window.electronAPI.showContextMenu();
  });
  const items = await window.electronAPI.getDirectoryContents(directoryPath);
  items.sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name))
       .forEach(item => fileExplorerElement.appendChild(createTreeItem(item, directoryPath)));
}

// --- Lógica de Creación y Guardado ---
async function handleNewItem(type: 'file' | 'directory') {
  const targetPath = contextMenuTargetPath;
  const isTargetDirectory = document.querySelector(`[data-path="${targetPath}"]`)?.dataset.isDirectory === 'true';
  const parentDir = isTargetDirectory ? targetPath : path.dirname(targetPath);
  const itemName = prompt(`Introduce el nombre:`);
  if (!itemName) return;
  const fullPath = path.join(parentDir, itemName);
  const result = type === 'file' ? await window.electronAPI.createFile(fullPath) : await window.electronAPI.createDirectory(fullPath);
  if (result.success) {
    showNotification(`${type === 'file' ? 'Archivo' : 'Directorio'} creado.`);
    const parentElement = document.querySelector(`[data-path="${parentDir}"]`) as HTMLElement;
    if (parentElement) {
       // La forma más sencilla de refrescar es recargar el árbol
       loadFileTree(currentRootPath);
    }
  } else {
    showNotification(`Error: ${result.error}`, 5000);
  }
}
async function saveCurrentFile() {
  if (activeFile && editor) {
    const content = editor.getValue();
    const result = await window.electronAPI.saveFile(activeFile, content);
    if(result.success) showNotification('Archivo guardado.');
  }
}

// --- Event Listeners Globales ---
window.electronAPI.onDirectoryOpened(loadFileTree);
window.electronAPI.onSaveFileRequest(saveCurrentFile);
window.electronAPI.onContextMenuCommand((command) => {
  if (command === 'new-file') handleNewItem('file');
  if (command === 'new-directory') handleNewItem('directory');
});

// --- Estilos Inyectados ---
const style = document.createElement('style');
style.textContent = `
  .children { padding-left: 15px; border-left: 1px solid #444; margin-left: 7px; }
  .file-icon { width: 16px; height: 16px; margin-right: 5px; vertical-align: middle; }
  .file-item.active > span { font-weight: bold; }
  .notification { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background-color: #333; color: white; padding: 10px 20px; border-radius: 5px; z-index: 1000; }
`;
document.head.appendChild(style);
