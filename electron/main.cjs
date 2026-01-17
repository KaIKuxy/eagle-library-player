const { app, BrowserWindow, ipcMain, protocol, screen } = require('electron');
const path = require('path');
const fs = require('fs');



let mainWindow;
let saveTimeout;

// Register Privileges for Byte-Stream / Video Support
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'local-media',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            bypassCSP: true,
            stream: true
        }
    }
]);

function getWindowStatePath() {
    return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState() {
    try {
        const statePath = getWindowStatePath();
        if (fs.existsSync(statePath)) {
            return JSON.parse(fs.readFileSync(statePath, 'utf8'));
        }
    } catch (e) {
        console.error('Failed to load window state:', e);
    }
    return null;
}

function saveWindowState(win) {
    if (!win || win.isDestroyed()) return;
    try {
        const bounds = win.getBounds();
        const state = {
            ...bounds,
            isFullScreen: win.isFullScreen(),
            isMaximized: win.isMaximized()
        };
        fs.writeFileSync(getWindowStatePath(), JSON.stringify(state));
    } catch (e) {
        console.error('Failed to save window state:', e);
    }
}

function scheduleSave(win) {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveWindowState(win);
    }, 1000);
}

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: userScreenWidth, height: userScreenHeight } = primaryDisplay.workAreaSize;

    // Default values
    let width = 800;
    let height = 600;
    let x = Math.round(userScreenWidth / 2 - 400);
    let y = Math.round(userScreenHeight / 2 - 300);

    const savedState = loadWindowState();
    if (savedState) {
        // Simple validation to ensure valid numbers
        if (typeof savedState.width === 'number' && typeof savedState.height === 'number') {
            width = savedState.width;
            height = savedState.height;
        }
        if (typeof savedState.x === 'number' && typeof savedState.y === 'number') {
            x = savedState.x;
            y = savedState.y;
        }
    }

    mainWindow = new BrowserWindow({
        width,
        height,
        x,
        y,
        frame: false, // Borderless
        transparent: false, // Debug: disable transparent
        backgroundColor: '#2e2c29', // Debug: visible background
        hasShadow: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true // Keep true, we use custom protocol
        }
    });

    // Open DevTools only if not packaged OR if it's a Debug Build
    const isDebugBuild = require('../package.json').debugBuild === true;
    if (!app.isPackaged || isDebugBuild) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // Save state on events
    mainWindow.on('resize', () => scheduleSave(mainWindow));
    mainWindow.on('move', () => scheduleSave(mainWindow));
    mainWindow.on('close', () => saveWindowState(mainWindow));

    // Load Vite Dev Server or Build
    const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../dist/index.html')}`;
    mainWindow.loadURL(startUrl);

    // Restore Fullscreen or Maximized state
    if (savedState) {
        if (savedState.isFullScreen) {
            mainWindow.setFullScreen(true);
        } else if (savedState.isMaximized) {
            mainWindow.maximize();
        }
    }

    mainWindow.on('closed', () => (mainWindow = null));

    let lastServedPath = '';
    protocol.registerFileProtocol('local-media', (request, callback) => {
        let finalPath;
        try {
            const u = new URL(request.url);
            let pathname = decodeURI(u.pathname);

            if (process.platform === 'win32') {
                // Case 1: local-media://d/path -> host="d", path="/path"
                if (u.hostname && u.hostname.length === 1) {
                    finalPath = u.hostname + ':' + pathname;
                }
                // Case 2: local-media:///D:/path -> host="", path="/D:/path"
                else if (pathname.startsWith('/') && /^[a-zA-Z]:/.test(pathname.slice(1))) {
                    finalPath = pathname.slice(1);
                }
                else {
                    finalPath = pathname;
                }
            } else {
                finalPath = pathname;
            }
        } catch (e) {
            console.error('[Media Protocol] URL parse failed', e);
            const raw = request.url.replace(/^local-media:\/\//, '');
            finalPath = decodeURI(raw);
        }

        if (finalPath !== lastServedPath) {
            console.log('[Media Protocol] Serving:', finalPath);
            lastServedPath = finalPath;
        }



        // Check existence for debugging
        if (!fs.existsSync(finalPath)) {
            console.error('File Exists: NO', finalPath);
        }

        return callback(finalPath);
    });
}

// Allow autoplay without user interaction
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// --- IPC Handlers ---

// Window Controls
ipcMain.on('window-control', (event, action) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    switch (action) {
        case 'minimize':
            win.minimize();
            break;
        case 'maximize':
            if (win.isMaximized()) win.unmaximize();
            else win.maximize();
            break;
        case 'close':
            win.close();
            break;
    }
});

// Resizing Hook
// Resizing Hook
ipcMain.on('resize-window', (event, { direction, delta }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    // Get current bounds (if fullscreen, this is screen size)
    let { x, y, width, height } = win.getBounds();

    if (win.isFullScreen()) {
        win.setFullScreen(false);
        // Explicitly set bounds to what they were (screen size) to prevent restore to old size
        // We set them immediately so the subsequent resize calculation operates on these bounds
        win.setBounds({ x, y, width, height });
    }

    const minW = 200, minH = 200;

    if (direction.includes('right')) { // Right, Top-Right, Bottom-Right
        width += delta.x;
    }
    if (direction.includes('left')) { // Left, Top-Left, Bottom-Left
        width -= delta.x;
        x += delta.x;
    }
    if (direction.includes('bottom')) {
        height += delta.y;
    }
    if (direction.includes('top')) {
        height -= delta.y;
        y += delta.y;
    }

    if (width > minW && height > minH) {
        win.setBounds({ x, y, width, height });
    }
});

// Move Hook (Manual JS Drag)
ipcMain.on('window-move', (event, { x, y }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    const [currentX, currentY] = win.getPosition();
    win.setPosition(currentX + x, currentY + y);
});

// Always on Top Toggle
ipcMain.handle('toggle-always-on-top', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    const newState = !win.isAlwaysOnTop();
    win.setAlwaysOnTop(newState);
    return newState;
});


// Proxy for Item Update to avoid CORS
ipcMain.handle('update-item-tags', async (event, { id, tags }) => {
    try {
        const response = await fetch(`http://localhost:41595/api/item/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, tags })
        });
        const result = await response.json();
        return result; // contains { status: 'success', data: ... }
    } catch (e) {
        console.error('Failed to proxy update-item-tags:', e);
        throw e;
    }
});
