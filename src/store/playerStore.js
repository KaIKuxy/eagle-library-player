import { create } from 'zustand';
import { get, set as setKeyVal } from 'idb-keyval';

// Initial State
const initialState = {
    playlist: [],
    history: [], // Stack of item IDs
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    volume: 1,
    isMuted: false,
    isShuffle: false,
    isRepeat: false,
    isPlaylistPanelOpen: false,
    libraryPath: '',

    // Viewed History
    viewedItems: [], // Array of IDs
    skipViewed: false,

    // Video Progress
    currentTime: 0,
    duration: 0,
    seekToTime: null,

    // UI State
    folderIdNameMap: {} // Map<ID, Name>
};

export const usePlayerStore = create((set, getStore) => ({
    ...initialState,

    // Actions
    setPlaylist: (items) => {
        if (!items || items.length === 0) return;
        set({ playlist: items, currentIndex: 0, history: [], isPlaying: true });
    },

    clearPlaylist: () => {
        set({
            playlist: [],
            history: [],
            queue: [],
            currentIndex: -1,
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            seekToTime: null
        });
    },

    shufflePlaylist: () => {
        const { playlist, currentIndex } = getStore();
        if (playlist.length <= 1) return;

        const currentItem = currentIndex >= 0 ? playlist[currentIndex] : null;

        let itemsToShuffle = [...playlist];
        if (currentIndex >= 0 && currentIndex < itemsToShuffle.length) {
            itemsToShuffle.splice(currentIndex, 1);
        }

        // Fisher-Yates shuffle
        for (let i = itemsToShuffle.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [itemsToShuffle[i], itemsToShuffle[j]] = [itemsToShuffle[j], itemsToShuffle[i]];
        }

        let finalPlaylist = itemsToShuffle;
        let newIndex = currentIndex;

        if (currentItem) {
            finalPlaylist = [currentItem, ...itemsToShuffle];
            newIndex = 0;
        }

        set({ playlist: finalPlaylist, currentIndex: newIndex });
    },

    playItem: (index) => {
        const { playlist, history, currentIndex } = getStore();
        if (index >= 0 && index < playlist.length) {
            const newHistory = [...history, currentIndex].slice(-100);
            set({ currentIndex: index, isPlaying: true, history: newHistory });
        }
    },

    next: () => {
        const { playlist, currentIndex, skipViewed, viewedItems, playItem, clearPlaylist } = getStore();
        const isViewed = (item) => (viewedItems || []).includes(item.id);

        let nextIndex = -1;

        if (skipViewed) {
            // Find next unviewed item
            for (let i = currentIndex + 1; i < playlist.length; i++) {
                if (!isViewed(playlist[i])) {
                    nextIndex = i;
                    break;
                }
            }
            if (nextIndex === -1) {
                // Wrap around search
                for (let i = 0; i <= currentIndex; i++) {
                    if (!isViewed(playlist[i])) {
                        nextIndex = i;
                        break;
                    }
                }
            }

            if (nextIndex !== -1) {
                playItem(nextIndex);
            } else {
                console.log("All items viewed, unloading playlist.");
                clearPlaylist();
            }

        } else {
            if (currentIndex < playlist.length - 1) {
                playItem(currentIndex + 1);
            } else {
                playItem(0); // Loop
            }
        }
    },

    previous: () => {
        const { playlist, currentIndex } = getStore();
        if (currentIndex > 0) {
            getStore().playItem(currentIndex - 1);
        }
    },

    previousHistory: () => {
        const { history } = getStore();
        if (history.length > 0) {
            const lastIndex = history[history.length - 1];
            const newHistory = history.slice(0, -1);
            set({ currentIndex: lastIndex, history: newHistory, isPlaying: true });
        }
    },

    togglePlay: () => set(state => ({ isPlaying: !state.isPlaying })),

    setVolume: (val) => set({ volume: val }),

    setPlaylistPanelOpen: (isOpen) => set({ isPlaylistPanelOpen: isOpen }),
    togglePlaylistPanel: () => set(state => ({ isPlaylistPanelOpen: !state.isPlaylistPanelOpen })),

    updateProgress: (currentTime, duration) => set({ currentTime, duration }),
    requestSeek: (time) => set({ seekToTime: time }),
    consumeSeek: () => set({ seekToTime: null }),
    setLibraryPath: (path) => set({ libraryPath: path }),

    setFolderList: (folders) => {
        const map = {};
        const traverse = (list, parentPath) => {
            if (!list) return;
            list.forEach(f => {
                const currentPath = parentPath ? `${parentPath} > ${f.name}` : f.name;
                map[f.id] = currentPath;
                if (f.children && f.children.length > 0) {
                    traverse(f.children, currentPath);
                }
            });
        };
        traverse(folders);
        set({ folderIdNameMap: map });
    },

    updateItemTags: (itemId, newTags) => {
        const { playlist } = getStore();
        const index = playlist.findIndex(item => item.id === itemId);
        if (index !== -1) {
            const newPlaylist = [...playlist];
            newPlaylist[index] = { ...newPlaylist[index], tags: newTags };
            set({ playlist: newPlaylist });
        }
    },

    likeTags: [],
    setLikeTags: (tags) => set({ likeTags: tags }),

    markAsViewed: (id) => set(state => {
        const items = Array.isArray(state.viewedItems) ? state.viewedItems : [];
        if (!items.includes(id)) {
            return { viewedItems: [...items, id] };
        }
        return {};
    }),
    toggleSkipViewed: () => set(state => ({ skipViewed: !state.skipViewed })),
    clearViewedHistory: () => set({ viewedItems: [] }),

    hydrate: async () => {
        if (usePlayerStore.getState()._hasHydrated) return;
        usePlayerStore.setState({ _hasHydrated: true });

        console.log('Hydrating player store...');

        // SETUP SUBSCRIPTION IMMEDIATELY
        // This ensures we never miss an update, even if initial hydration takes time.
        console.log('Persistence subscription started (Sync).');

        usePlayerStore.subscribe((state, prevState) => {
            // 1. Handle Playlist Persistence (IndexedDB - Async)
            if (state.playlist !== prevState.playlist) {
                if (state.playlist && state.playlist.length > 0) {
                    console.log('Persisting Playlist to IDB...', state.playlist.length);
                    setKeyVal('player-playlist', state.playlist)
                        .then(() => console.log('Playlist Saved to IDB'))
                        .catch(e => console.error('Playlist Save Failed:', e));
                } else if (prevState.playlist && prevState.playlist.length > 0 && state.playlist.length === 0) {
                    // Explicit clear
                    console.log('Clearing Playlist from IDB');
                    setKeyVal('player-playlist', []).catch(e => console.error(e));
                }
            }

            // 2. Handle Viewed Items Persistence (IndexedDB - Async)
            if (state.viewedItems !== prevState.viewedItems) {
                const items = state.viewedItems || [];
                setKeyVal('player-viewed-items', items).catch(e => console.error(e));
            }

            // 3. Handle Config Persistence (LocalStorage - Sync)
            const CONFIG_KEYS = ['history', 'currentIndex', 'volume', 'isMuted', 'isShuffle', 'isRepeat', 'likeTags', 'skipViewed', 'libraryPath'];
            const shouldPersistConfig = CONFIG_KEYS.some(key => state[key] !== prevState[key]);

            if (shouldPersistConfig) {
                const config = CONFIG_KEYS.reduce((acc, key) => ({ ...acc, [key]: state[key] }), {});
                try {
                    localStorage.setItem('player-config', JSON.stringify(config));
                } catch (e) {
                    console.error('Config persistence failed:', e);
                }
            }
        });

        // 1. Synchronous: Load tiny config from LocalStorage
        try {
            const savedConfigString = localStorage.getItem('player-config');
            const savedLegacyString = localStorage.getItem('player-state'); // Fallback check

            let startState = {};

            if (savedConfigString) {
                startState = JSON.parse(savedConfigString);
                // SAFEGUARD: Remove heavy/corrupt data that shouldn't be in config
                if (startState.playlist) delete startState.playlist;
                if (startState.viewedItems) delete startState.viewedItems;

            } else if (savedLegacyString) {
                // Partial legacy load for config
                const leg = JSON.parse(savedLegacyString);
                const { playlist, viewedItems, ...rest } = leg;
                startState = rest;
            }

            if (Object.keys(startState).length > 0) {
                set({ ...startState, isPlaying: true, currentTime: 0, duration: 0, seekToTime: null });
            }
        } catch (e) {
            console.error("Config hydration failed", e);
        }

        // 2. Asynchronous: Load heavy data (Playlist, ViewedItems) from IndexedDB
        try {
            console.log("Loading heavy data from IDB...");
            const [idbPlaylist, idbViewed] = await Promise.all([
                get('player-playlist'),
                get('player-viewed-items')
            ]);

            console.log("IDB Loaded. Playlist:", idbPlaylist?.length);

            let finalPlaylist = idbPlaylist;
            let finalViewed = idbViewed;

            // Migration from LocalStorage if IDB is empty
            if (!finalPlaylist) {
                // Check 'player-playlist' LS
                let lsP = localStorage.getItem('player-playlist');
                if (lsP) {
                    try {
                        const parsed = JSON.parse(lsP);
                        if (Array.isArray(parsed)) {
                            finalPlaylist = parsed;
                            console.log("Migrating LS Playlist to IDB...", finalPlaylist?.length);
                            await setKeyVal('player-playlist', finalPlaylist);
                            localStorage.removeItem('player-playlist');
                        }
                    } catch (e) { console.error("Migration Parse Error", e); }
                } else {
                    // Check 'player-state' legacy
                    const legacy = localStorage.getItem('player-state');
                    if (legacy) {
                        try {
                            const parsed = JSON.parse(legacy);
                            if (parsed.playlist) {
                                finalPlaylist = parsed.playlist;
                                console.log("Migrating Legacy Playlist to IDB...", finalPlaylist?.length);
                                await setKeyVal('player-playlist', finalPlaylist);
                            }
                        } catch (e) { }
                    }
                }
            }

            if (!finalViewed) {
                let lsV = localStorage.getItem('player-viewed-items');
                if (lsV) {
                    try {
                        finalViewed = JSON.parse(lsV);
                        console.log("Migrating LS ViewedItems to IDB...");
                        await setKeyVal('player-viewed-items', finalViewed);
                        localStorage.removeItem('player-viewed-items');
                    } catch (e) { }
                } else {
                    const legacy = localStorage.getItem('player-state');
                    if (legacy) {
                        try {
                            const parsed = JSON.parse(legacy);
                            if (parsed.viewedItems) {
                                finalViewed = parsed.viewedItems;
                                await setKeyVal('player-viewed-items', finalViewed);
                            }
                        } catch (e) { }
                    }
                }
            }

            // Cleanup legacy file only if we fully migrated
            if (finalPlaylist && finalViewed && localStorage.getItem('player-state')) {
                localStorage.removeItem('player-state');
            }

            // Apply Heavy Data
            if (finalPlaylist || finalViewed) {
                console.log("Applying final heavy data to store...", finalPlaylist?.length);
                set(state => ({
                    playlist: finalPlaylist || state.playlist || [],
                    viewedItems: finalViewed || state.viewedItems || []
                }));
            }

            console.log("Heavy Hydration Complete.");

        } catch (e) {
            console.error("Heavy hydration failed", e);
        }
    }
}));
