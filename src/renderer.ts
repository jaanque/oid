import './index.css';
import * as monaco from 'monaco-editor';
import path from 'node:path'; // Importamos 'path' para unir rutas

// Tipado para la API expuesta en el preload
declare global {
  interface Window {
    electronAPI: {
      getDirectoryContents: (directoryPath: string) => Promise<{ name: string; isDirectory: boolean }[]>;
      getFileContent: (filePath: string) => Promise<string>;
      onDirectoryOpened: (callback: (path: string) => void) => void;
    };
  }
}

const editorElement = document.getElementById('editor-container');
const fileExplorerElement = document.getElementById('file-explorer');
let editor: monaco.editor.IStandaloneCodeEditor | undefined;

// 1. Inicializar el editor de Monaco
if (editorElement) {
  editor = monaco.editor.create(editorElement, {
    value: `// Usa el menú "File > Abrir Directorio..." para empezar a trabajar.`,
    language: 'plaintext',
    theme: 'vs-dark',
    automaticLayout: true,
  });
}

// 2. Función para cargar y mostrar el contenido de un directorio
async function loadFiles(directoryPath: string) {
  if (!fileExplorerElement) return;

  fileExplorerElement.innerHTML = `<h2>${path.basename(directoryPath)}</h2>`;
  const items = await window.electronAPI.getDirectoryContents(directoryPath);
  
  items.forEach(item => {
    const itemElement = document.createElement('div');
    // Añadimos un ícono simple para diferenciar carpetas y archivos
    itemElement.textContent = `${item.isDirectory ? '📁' : '📄'} ${item.name}`;
    itemElement.className = 'file-item';
    
    // Solo añadimos evento de clic a los archivos
    if (!item.isDirectory) {
      itemElement.addEventListener('click', async () => {
        const fullPath = path.join(directoryPath, item.name); // Construimos la ruta completa
        const content = await window.electronAPI.getFileContent(fullPath);
        
        if (editor) {
          editor.setValue(content);
        }
      });
    }
    
    fileExplorerElement.appendChild(itemElement);
  });
}

// 3. Escuchar el evento que nos envía el directorio seleccionado desde el menú
window.electronAPI.onDirectoryOpened((directoryPath) => {
  console.log(`Directorio abierto: ${directoryPath}`);
  loadFiles(directoryPath);
});

// 4. Inyectar estilos para el explorador
const style = document.createElement('style');
style.textContent = `
  h2 {
    font-size: 1em;
    margin-top: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .file-item {
    margin: 2px 0;
    padding: 5px;
    cursor: pointer;
    border-radius: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: none; /* Evita que el texto se seleccione al hacer clic */
  }
  .file-item:hover {
    background-color: #3a3d41;
  }
`;
document.head.appendChild(style);