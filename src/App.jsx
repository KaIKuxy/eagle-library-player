import React, { useEffect, useRef } from 'react';
import Player from './components/Player';
import Controls from './components/Controls';
import InfoPanel from './components/InfoPanel';
import ResizeHandles from './components/ResizeHandles';
import PlaylistPanel from './components/PlaylistPanel';
import ToastContainer from './components/ToastContainer';
import { usePlayerStore } from './store/playerStore';
import { useToastStore } from './store/toastStore';
import { eagleService } from './services/eagle';

const App = () => {
    const hydrate = usePlayerStore(state => state.hydrate);
    const setPlaylist = usePlayerStore(state => state.setPlaylist);
    const setLibraryPath = usePlayerStore(state => state.setLibraryPath);
    const setFolderList = usePlayerStore(state => state.setFolderList);
    const { addToast } = useToastStore();
    const wasPlayingRef = useRef(false);

    useEffect(() => {
        hydrate();

        const init = async () => {
            // Always initialize library path for media serving
            try {
                const info = await eagleService.getLibraryInfo();
                if (info?.data?.library?.path) {
                    setLibraryPath(info.data.library.path);
                }

                const folders = await eagleService.getFolderList();
                setFolderList(folders);
            } catch (e) {
                console.error("Failed to init library info", e);
            }


        };

        init();

        // Listen for Playlist updates from Electron Main
        if (window.electron) {
            window.electron.onPlaylistUpdate((items) => {
                console.log('App.jsx received playlist:', items?.length);
                setPlaylist(items);
            });
        }
    }, [hydrate, setPlaylist]);

    // Visibility Logic (Auto Pause/Resume)
    useEffect(() => {
        // "when the media player is covered by other windows or minimized..."
        // Page Visibility API only detects if the tab is hidden (minimized or switched tab).
        // It does NOT detect if another window covers it efficiently in standard web apps 
        // without generic "occlusion" APIs which are not standard.
        // But standard "minimize" is covered by visibilitychange.

        const handleVisibilityChange = () => {
            if (document.hidden) {
                // User requirement: "auto pause... when minimized"
                // Save state to know if we should resume
                wasPlayingRef.current = usePlayerStore.getState().isPlaying;
                if (wasPlayingRef.current) {
                    usePlayerStore.setState({ isPlaying: false });
                }
            } else {
                // Resume if it was playing and NOT manually paused?
                // Logic: "...auto resume when its nolonger covered or minimized"
                // "when manually paused, the media should not be auto resume" -> This is implied by only resuming if we auto-paused it.
                if (wasPlayingRef.current) {
                    usePlayerStore.setState({ isPlaying: true });
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    // Exit Fullscreen on Resize
    useEffect(() => {
        const handleResize = () => {
            if (document.fullscreenElement) {
                // If window size is significantly different from screen size, we likely snapped/resized
                const isFullScreenSize = Math.abs(window.innerWidth - screen.width) < 20 && Math.abs(window.innerHeight - screen.height) < 20;
                if (!isFullScreenSize) {
                    document.exitFullscreen().catch(e => console.log("Failed to exit fullscreen", e));
                }
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="app-container">
            <ResizeHandles />
            {/* Drag Region */}
            <div style={{
                position: 'fixed', top: 0, left: 0, width: '100%', height: '40px',
                WebkitAppRegion: 'drag', zIndex: 100, pointerEvents: 'none'
            }} />

            <PlaylistPanel />
            <Player />
            <Controls />
            <InfoPanel />
            <ToastContainer />

            {/* Top Bar Shield (Simulated "No top bar" is handled by OS/Browser, but we ensure no internal headers) */}
        </div>
    );
}

export default App;
