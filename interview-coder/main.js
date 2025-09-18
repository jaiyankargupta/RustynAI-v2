const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Check if dist-electron/main.js exists
const mainJsPath = path.join(__dirname, 'dist-electron', 'main.js');
if (fs.existsSync(mainJsPath)) {
    // If it exists, require it
    try {
        require(mainJsPath);
    } catch (error) {
        console.error('Error loading dist-electron/main.js:', error);
        startFallbackApp();
    }
} else {
    console.error(`Could not find ${mainJsPath}`);
    startFallbackApp();
}

// Fallback minimal Electron app
function startFallbackApp() {
    console.log('Starting fallback app...');

    function createWindow() {
        const mainWindow = new BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            }
        });

        mainWindow.loadFile('index.html');
    }

    app.whenReady().then(() => {
        createWindow();

        app.on('activate', function () {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

    app.on('window-all-closed', function () {
        if (process.platform !== 'darwin') app.quit();
    });
}
