import { create } from 'zustand';

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

export const usePlayerStore = create((set, get) => ({
    ...initialState,

    // Actions
    setPlaylist: (items) => {
        // If items empty, reset
        if (!items || items.length === 0) return;

        // Check if identical to avoid index reset?
        // Simple length check or first item check
        // const { playlist } = get();
        // if (playlist.length === items.length && playlist[0]?.id === items[0]?.id) return;

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
        const { playlist, currentIndex } = get();
        if (playlist.length <= 1) return;

        const currentItem = currentIndex >= 0 ? playlist[currentIndex] : null;

        let itemsToShuffle = [...playlist];
        if (currentIndex >= 0 && currentIndex < itemsToShuffle.length) {
            itemsToShuffle.splice(currentIndex, 1);
        }

        // Fisher-Yates shuffle on the rest
        for (let i = itemsToShuffle.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [itemsToShuffle[i], itemsToShuffle[j]] = [itemsToShuffle[j], itemsToShuffle[i]];
        }

        // Reconstruct playlist with current item at top
        let finalPlaylist = itemsToShuffle;
        let newIndex = currentIndex;

        if (currentItem) {
            finalPlaylist = [currentItem, ...itemsToShuffle];
            newIndex = 0;
        }

        set({ playlist: finalPlaylist, currentIndex: newIndex });
    },

    playItem: (index) => {
        const { playlist, history, currentIndex } = get();
        if (index >= 0 && index < playlist.length) {
            const newHistory = [...history, currentIndex].slice(-100);
            set({ currentIndex: index, isPlaying: true, history: newHistory });
        }
    },

    next: () => {
        const { playlist, currentIndex, skipViewed, viewedItems, playItem, clearPlaylist } = get();

        // Helper to check if an item is viewed
        const isViewed = (item) => viewedItems.includes(item.id);

        let nextIndex = -1;

        if (skipViewed) {
            // Find next unviewed item
            // 1. Search ahead
            for (let i = currentIndex + 1; i < playlist.length; i++) {
                if (!isViewed(playlist[i])) {
                    nextIndex = i;
                    break;
                }
            }
            // 2. Wrap around if looping is desired (assumed yes since original had loop)
            // But user requirement says "if playlist does not have non visited media... unload".
            // So we should check if ANY unvisited media exists first?
            // "when media player play next media, it should skip the visited medial"
            if (nextIndex === -1) {
                // Search from 0 to currentIndex
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
                // No unviewed items found
                console.log("All items viewed, unloading playlist.");
                clearPlaylist();
            }

        } else {
            // Normal behavior
            if (currentIndex < playlist.length - 1) {
                playItem(currentIndex + 1);
            } else {
                playItem(0); // Loop
            }
        }
    },

    previous: () => {
        const { playlist, currentIndex } = get();
        if (currentIndex > 0) {
            get().playItem(currentIndex - 1);
        }
    },

    previousHistory: () => {
        const { history } = get();
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

    // Video Progress Actions
    updateProgress: (currentTime, duration) => set({ currentTime, duration }),
    requestSeek: (time) => set({ seekToTime: time }),
    consumeSeek: () => set({ seekToTime: null }),
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
        const { playlist } = get();
        const index = playlist.findIndex(item => item.id === itemId);
        if (index !== -1) {
            const newPlaylist = [...playlist];
            newPlaylist[index] = { ...newPlaylist[index], tags: newTags };
            set({ playlist: newPlaylist });
        }
    },

    // Default Like Tags
    likeTags: [],
    setLikeTags: (tags) => set({ likeTags: tags }),

    // Viewed Actions
    markAsViewed: (id) => set(state => {
        if (!state.viewedItems.includes(id)) {
            return { viewedItems: [...state.viewedItems, id] };
        }
        return {};
    }),
    toggleSkipViewed: () => set(state => ({ skipViewed: !state.skipViewed })),
    clearViewedHistory: () => set({ viewedItems: [] }),


    // Hydration
    hydrate: () => {
        console.log('Hydrating player store (localStorage)...');
        try {
            const savedString = localStorage.getItem('player-state');
            if (savedString) {
                const saved = JSON.parse(savedString);
                console.log('Hydration found saved state:', {
                    playlistLen: saved.playlist?.length,
                    currentIndex: saved.currentIndex
                });
                // Restore state AND force play, but reset ephemeral
                set({ ...saved, isPlaying: true, currentTime: 0, duration: 0, seekToTime: null });
            } else {
                console.log('Hydration: No saved state found.');
            }
        } catch (err) {
            console.error('Hydration failed:', err);
        }

        // Start persisting *after* hydration attempt
        console.log('Persistence subscription started.');

        const PERSIST_KEYS = ['playlist', 'history', 'currentIndex', 'volume', 'isMuted', 'isShuffle', 'isRepeat', 'likeTags', 'viewedItems', 'skipViewed'];

        usePlayerStore.subscribe((state, prevState) => {
            // Optimization: Only persist if one of the monitored keys changed
            // This prevents writing on every 'currentTime' update (60fps)
            const shouldPersist = PERSIST_KEYS.some(key => state[key] !== prevState[key]);

            if (shouldPersist) {
                const { playlist, history, currentIndex, volume, isMuted, isShuffle, isRepeat, likeTags, viewedItems, skipViewed } = state;
                try {
                    localStorage.setItem('player-state', JSON.stringify({
                        playlist, history, currentIndex, volume, isMuted, isShuffle, isRepeat, likeTags,
                        viewedItems, skipViewed
                    }));
                } catch (e) {
                    console.error('Persistence failed:', e);
                }
            }
        });
    }
}));
