const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

let mainWindow = null;

// Unique hardware-bound Device ID for Windows machine
function getMachineDeviceId() {
  try {
    const raw = [
      os.hostname(),
      os.userInfo().username,
      os.platform(),
      os.arch(),
      os.cpus().map(c => c.model).join(','),
      os.totalmem(),
    ].join('##');
    const hash = crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16).toUpperCase();
    return `WIN-${hash}`;
  } catch (e) {
    return `WIN-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  }
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 1024,
    minHeight: 640,
    title: 'PW Pro by Shivansh — VIP Study Suite & Admin',
    backgroundColor: '#0a0a0a',
    frame: true, // Native Windows frame for clean standard minimize/maximize/close
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allows direct CloudFront CDN HLS segment streaming without CORS restrictions
      allowRunningInsecureContent: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('get-device-id', () => {
  return getMachineDeviceId();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion() || '1.5.0';
});

ipcMain.handle('open-external', (event, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
  }
});

// Download PDF note directly to user's Downloads/PW Pro Notes/
ipcMain.handle('download-pdf', async (event, { url, filename }) => {
  try {
    const downloadsDir = path.join(app.getPath('downloads'), 'PW Pro Notes');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const safeName = (filename || 'PW_Note.pdf').replace(/[/\\?%*:|"<>]/g, '_');
    const destPath = path.join(downloadsDir, safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`);

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      https.get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          https.get(response.headers.location, (res2) => {
            res2.pipe(file);
            file.on('finish', () => {
              file.close(() => resolve({ success: true, path: destPath }));
            });
          }).on('error', reject);
        } else {
          response.pipe(file);
          file.on('finish', () => {
            file.close(() => resolve({ success: true, path: destPath }));
          });
        }
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('show-in-folder', (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
  }
});
