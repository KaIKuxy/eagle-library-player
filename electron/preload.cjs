const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    // Window Controls
    minimize: () => ipcRenderer.send('window-control', 'minimize'),
    maximize: () => ipcRenderer.send('window-control', 'maximize'),
    close: () => ipcRenderer.send('window-control', 'close'),
    resize: (direction, delta) => ipcRenderer.send('resize-window', { direction, delta }),
    moveWindow: (delta) => ipcRenderer.send('window-move', delta),
    toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),

    // Playlist
    openPlaylist: () => ipcRenderer.send('open-playlist'),
    setPlaylist: (items) => ipcRenderer.send('set-playlist', items),
    onPlaylistUpdate: (callback) => ipcRenderer.on('playlist-updated', (event, items) => callback(items)),

    // Eagle API Proxy
    updateItemTags: (id, tags) => ipcRenderer.invoke('update-item-tags', { id, tags }),



    // Platform check
    isElectron: true
});
