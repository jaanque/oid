import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';

// Handle creando/quitando accesos directos
if (started) {
  app.quit();
}

// --- Lógica de IPC (Inter-Process Communication) ---

// Responde a la petición de leer el contenido de un directorio específico
ipcMain.handle('get-directory-contents', async (event, directoryPath: string) => {
  try {
    const files = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    // Mapeamos para devolver solo el nombre y si es un directorio
    return files.map(file => ({
      name: file.name,
      isDirectory: file.isDirectory(),
    }));
  } catch (error) {
    console.error(`Error leyendo el directorio: ${directoryPath}`, error);
    return [];
  }
});

// Responde a la petición de leer el contenido de un archivo específico
ipcMain.handle('get-file-content', async (event, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error(`No se pudo leer el archivo: ${filePath}`, error);
    return `// No se pudo cargar el archivo: ${filePath}`;
  }
});

// Responde a la petición de guardar el contenido de un archivo
ipcMain.handle('save-file', async (event, { filePath, content }: { filePath: string; content: string }) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    console.error(`Error guardando el archivo: ${filePath}`, error);
    return { success: false, error: (error as Error).message };
  }
});

// Responde a la petición de crear un nuevo archivo
ipcMain.handle('create-file', async (event, filePath: string) => {
  try {
    await fs.promises.writeFile(filePath, '', 'utf-8'); // Crea un archivo vacío
    return { success: true };
  } catch (error) {
    console.error(`Error creando el archivo: ${filePath}`, error);
    return { success: false, error: (error as Error).message };
  }
});

// Responde a la petición de crear un nuevo directorio
ipcMain.handle('create-directory', async (event, dirPath: string) => {
  try {
    await fs.promises.mkdir(dirPath);
    return { success: true };
  } catch (error) {
    console.error(`Error creando el directorio: ${dirPath}`, error);
    return { success: false, error: (error as Error).message };
  }
});


// --- Creación de la Ventana Principal ---

const createWindow = () => {
  // Menú contextual para el explorador de archivos
  const fileExplorerContextMenu = Menu.buildFromTemplate([
    {
      label: 'Nuevo Archivo',
      click: (menuItem, browserWindow) => {
        browserWindow.webContents.send('context-menu-command', 'new-file');
      },
    },
    {
      label: 'Nueva Carpeta',
      click: (menuItem, browserWindow) => {
        browserWindow.webContents.send('context-menu-command', 'new-directory');
      },
    },
  ]);

  ipcMain.on('show-context-menu', (event) => {
    fileExplorerContextMenu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
  });

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
    },
  });

  // --- Definición del Menú de la Aplicación ---
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Abrir Directorio...',
          accelerator: 'CmdOrCtrl+O',
          async click() {
            const { filePaths } = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory'],
              title: 'Selecciona un directorio',
            });
            
            if (filePaths && filePaths.length > 0) {
              // Envía la ruta del directorio seleccionado al proceso de renderizado
              mainWindow.webContents.send('directory-opened', filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Guardar',
          accelerator: 'CmdOrCtrl+S',
          click() {
            // Envía un evento al proceso de renderizado para que inicie la acción de guardar
            mainWindow.webContents.send('save-file-request');
          },
        },
        { type: 'separator' },
        {
          label: 'Salir',
          role: 'quit',
          accelerator: 'CmdOrCtrl+Q',
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);


  // Carga la URL de desarrollo o el archivo HTML de producción
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

// --- Ciclo de Vida de la Aplicación ---

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});