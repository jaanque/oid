import './index.css';
import * as monaco from 'monaco-editor';
import path from 'node:path';

// --- Tipos y Declaraciones Globales ---

declare global {
  interface Window {
    electronAPI: {
      getDirectoryContents: (directoryPath: string) => Promise<{ name: string; isDirectory: boolean }[]>;
      getFileContent: (filePath: string) => Promise<string>;
      saveFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
      onDirectoryOpened: (callback: (path: string) => void) => void;
      onSaveFileRequest: (callback: () => void) => void;
    };
  }
}

// --- Elementos del DOM y Estado Global ---

const editorElement = document.getElementById('editor-container');
const fileExplorerElement = document.getElementById('file-explorer');
const tabsContainerElement = document.getElementById('tabs-container');

let editor: monaco.editor.IStandaloneCodeEditor | undefined;
const openFiles = new Map<string, monaco.editor.ITextModel>(); // filePath -> editor model
let activeFile: string | null = null; // Ruta del archivo activo

// --- Inicialización del Editor ---

if (editorElement) {
  editor = monaco.editor.create(editorElement, {
    value: `// Usa el menú "File > Abrir Directorio..." para empezar a trabajar.`,
    language: 'plaintext',
    theme: 'vs-dark',
    automaticLayout: true,
  });
}

// --- Lógica de Pestañas ---

/**
 * Renderiza las pestañas en la interfaz.
 */
function renderTabs() {
  if (!tabsContainerElement) return;
  tabsContainerElement.innerHTML = '';

  openFiles.forEach((_, filePath) => {
    const tabElement = document.createElement('div');
    tabElement.className = `tab-item ${filePath === activeFile ? 'active' : ''}`;
    tabElement.dataset.filePath = filePath;

    const fileName = document.createElement('span');
    fileName.textContent = path.basename(filePath);

    const closeBtn = document.createElement('span');
    closeBtn.textContent = 'x';
    closeBtn.className = 'tab-close-btn';

    tabElement.appendChild(fileName);
    tabElement.appendChild(closeBtn);
    tabsContainerElement.appendChild(tabElement);
  });
}

/**
 * Cambia la pestaña activa.
 * @param filePath - La ruta del archivo a activar.
 */
function switchToFile(filePath: string | null) {
  if (filePath && openFiles.has(filePath)) {
    activeFile = filePath;
    editor?.setModel(openFiles.get(filePath)!);
  } else {
    activeFile = null;
    editor?.setModel(null); // O mostrar un modelo por defecto
  }
  renderTabs();
}

/**
 * Cierra una pestaña y su archivo asociado.
 * @param filePath - La ruta del archivo a cerrar.
 */
function closeFile(filePath: string) {
  const model = openFiles.get(filePath);
  if (model) {
    model.dispose(); // Libera la memoria del modelo
  }
  openFiles.delete(filePath);

  if (activeFile === filePath) {
    // Si cerrramos el archivo activo, abrimos el siguiente o ninguno
    const nextFile = openFiles.keys().next().value || null;
    switchToFile(nextFile);
  } else {
    renderTabs();
  }
}

// Event listener para el contenedor de pestañas (delegación de eventos)
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

/**
 * Maneja la apertura de un archivo: crea una pestaña y muestra el contenido.
 * @param filePath - La ruta completa del archivo.
 */
async function openFile(filePath: string) {
  if (openFiles.has(filePath)) {
    // Si el archivo ya está abierto, simplemente cambiamos a su pestaña
    switchToFile(filePath);
    return;
  }

  const content = await window.electronAPI.getFileContent(filePath);
  const fileExtension = path.extname(filePath).substring(1);
  const model = monaco.editor.createModel(content, fileExtension);
  
  openFiles.set(filePath, model);
  switchToFile(filePath);
}

/**
 * Crea y renderiza un elemento del árbol de archivos.
 */
function createTreeItem(item: { name: string; isDirectory: boolean }, parentPath: string) {
  const fullPath = path.join(parentPath, item.name);
  const itemElement = document.createElement('div');
  itemElement.className = 'file-item';

  const icon = item.isDirectory ? '📁' : '📄';
  itemElement.innerHTML = `<span>${icon} ${item.name}</span>`;

  itemElement.addEventListener('click', async (e) => {
    e.stopPropagation();

    if (item.isDirectory) {
      const isExpanded = itemElement.classList.contains('expanded');
      if (isExpanded) {
        itemElement.classList.remove('expanded');
        const childrenContainer = itemElement.querySelector('.children');
        if (childrenContainer) itemElement.removeChild(childrenContainer);
        itemElement.querySelector('span')!.innerHTML = `📁 ${item.name}`;
      } else {
        itemElement.classList.add('expanded');
        const children = await window.electronAPI.getDirectoryContents(fullPath);
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'children';
        children.forEach(child => childrenContainer.appendChild(createTreeItem(child, fullPath)));
        itemElement.appendChild(childrenContainer);
        itemElement.querySelector('span')!.innerHTML = `📂 ${item.name}`;
      }
    } else {
      openFile(fullPath);
    }
  });

  return itemElement;
}

/**
 * Carga y muestra el árbol de archivos del directorio raíz.
 */
async function loadFileTree(directoryPath: string) {
  if (!fileExplorerElement) return;
  fileExplorerElement.innerHTML = `<h2>${path.basename(directoryPath)}</h2>`;
  const items = await window.electronAPI.getDirectoryContents(directoryPath);
  items.forEach(item => fileExplorerElement.appendChild(createTreeItem(item, directoryPath)));
}

// --- Lógica de Guardado ---

async function saveCurrentFile() {
  if (activeFile && editor) {
    const content = editor.getValue();
    const result = await window.electronAPI.saveFile(activeFile, content);
    if (result.success) {
      console.log(`Archivo guardado: ${activeFile}`);
    } else {
      console.error(`Error al guardar el archivo: ${result.error}`);
    }
  }
}

// --- Event Listeners Globales ---

window.electronAPI.onDirectoryOpened(loadFileTree);
window.electronAPI.onSaveFileRequest(saveCurrentFile);

// --- Estilos Inyectados ---

const style = document.createElement('style');
style.textContent = `
  .children {
    padding-left: 15px;
    border-left: 1px solid #444;
    margin-left: 7px;
  }
`;
document.head.appendChild(style);
