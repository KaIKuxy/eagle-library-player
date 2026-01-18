import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { eagleService } from '../services/eagle';
import PlaylistSetup from './PlaylistSetup';
import { Trash2, Shuffle, Check } from 'lucide-react';

const ITEM_HEIGHT = 68;
const RENDER_BUFFER = 10;

const PlaylistPanel = () => {
    const playlist = usePlayerStore(state => state.playlist);
    const currentIndex = usePlayerStore(state => state.currentIndex);
    const isPlaylistPanelOpen = usePlayerStore(state => state.isPlaylistPanelOpen);
    const viewedItems = usePlayerStore(state => state.viewedItems);

    // Actions
    const playItem = usePlayerStore(state => state.playItem);
    const setPlaylist = usePlayerStore(state => state.setPlaylist);
    const setPlaylistPanelOpen = usePlayerStore(state => state.setPlaylistPanelOpen);
    const clearPlaylist = usePlayerStore(state => state.clearPlaylist);
    const shufflePlaylist = usePlayerStore(state => state.shufflePlaylist);
    const containerRef = useRef(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        if (isHovered && containerRef.current && !isPlaylistPanelOpen) {
            const centerPos = (currentIndex * ITEM_HEIGHT) - (containerRef.current.clientHeight / 2) + (ITEM_HEIGHT / 2);
            containerRef.current.scrollTop = centerPos;
        }
    }, [isHovered, isPlaylistPanelOpen, currentIndex]);

    const handleScroll = (e) => {
        setScrollTop(e.target.scrollTop);
    };

    const handleSetupComplete = (items) => {
        setPlaylist(items);
        setPlaylistPanelOpen(false);
    };

    // Updated: No confirmation
    const handleClear = () => {
        clearPlaylist();
    };



    const totalHeight = playlist.length * ITEM_HEIGHT;
    const clientHeight = containerRef.current ? containerRef.current.clientHeight : 800;
    const startIdx = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - RENDER_BUFFER);
    const maxVisible = Math.ceil(clientHeight / ITEM_HEIGHT) + (2 * RENDER_BUFFER);
    const endIdx = Math.min(playlist.length, startIdx + maxVisible);

    const itemsToShow = [];
    for (let i = startIdx; i < endIdx; i++) {
        itemsToShow.push({
            realIdx: i,
            item: playlist[i]
        });
    }

    const paddingTop = startIdx * ITEM_HEIGHT;
    const paddingBottom = (playlist.length - endIdx) * ITEM_HEIGHT;

    const truncateMiddle = (text, maxLen = 34) => {
        if (!text || text.length <= maxLen) return text;
        const half = Math.floor((maxLen - 3) / 2);
        return text.slice(0, half) + '...' + text.slice(-half);
    };

    const renderItem = ({ item, realIdx }) => (
        <div
            key={realIdx}
            onClick={() => playItem(realIdx)}
            className={`playlist-item ${realIdx === currentIndex ? 'active' : ''}`}
        >
            <div className="thumb">
                <img
                    src={eagleService.getItemThumbnail(item)}
                    alt=""
                />
                {Array.isArray(viewedItems) && viewedItems.includes(item.id) && (
                    <div className="viewed-overlay">
                        <Check size={20} color="#4a9eff" strokeWidth={3} />
                    </div>
                )}
            </div>
            <div className="meta">
                <div className="name" title={item?.name}>
                    {truncateMiddle(item?.name)}
                </div>
            </div>
        </div>
    );

    return (
        <div
            className="playlist-wrapper"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="trigger-area" />
            <div className={`playlist-panel ${isPlaylistPanelOpen ? 'setup-mode' : ''}`}>
                <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                    <h3 style={{ margin: 0 }}>{isPlaylistPanelOpen ? 'Playlist Setup' : `Playlist (${playlist.length})`}</h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {!isPlaylistPanelOpen && playlist.length > 0 && (
                            <button
                                onClick={handleClear}
                                title="Clear Playlist"
                                style={{
                                    background: 'none',
                                    border: '1px solid rgba(255,100,100,0.4)',
                                    color: '#ff8888',
                                    cursor: 'pointer',
                                    padding: '4px 6px',
                                    borderRadius: 4,
                                    display: 'flex', alignItems: 'center'
                                }}
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                        {!isPlaylistPanelOpen && playlist.length > 1 && (
                            <button
                                onClick={shufflePlaylist}
                                title="Shuffle Playlist"
                                style={{
                                    background: 'none',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    color: '#eee',
                                    cursor: 'pointer',
                                    padding: '4px 6px',
                                    borderRadius: 4,
                                    display: 'flex', alignItems: 'center'
                                }}
                            >
                                <Shuffle size={16} />
                            </button>
                        )}
                        <button
                            onClick={() => setPlaylistPanelOpen(!isPlaylistPanelOpen)}
                            style={{
                                background: 'none',
                                border: '1px solid rgba(255,255,255,0.2)',
                                color: 'white',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: 4,
                                fontSize: '0.8rem'
                            }}
                        >
                            {isPlaylistPanelOpen ? 'Close' : 'Setup'}
                        </button>
                    </div>
                </div>


                {isPlaylistPanelOpen ? (
                    <PlaylistSetup onSetupComplete={handleSetupComplete} />
                ) : (
                    <div
                        className="list-container"
                        ref={containerRef}
                        onScroll={handleScroll}
                    >
                        <div style={{ paddingTop, paddingBottom }}>
                            {itemsToShow.map(renderItem)}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .playlist-wrapper {
                    position: fixed;
                    top: 0;
                    left: 0;
                    height: calc(100% - 130px);
                    z-index: 200; /* Above Drag Region (100) */
                    display: flex;
                    -webkit-app-region: no-drag;
                }
                .trigger-area {
                    width: 20px;
                    height: 100%;
                }
                .playlist-panel {
                    width: 400px;
                    height: 100%;
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(10px);
                    padding: 20px;
                    transform: translateX(-100%);
                    transition: transform 0.3s ease, width 0.3s ease;
                    display: flex;
                    flex-direction: column;
                    border-right: 1px solid rgba(255,255,255,0.1);
                    color: white;
                    margin-left: -20px;
                }
                
                .playlist-panel.setup-mode {
                    /* Width is now consistent */
                }
                
               .playlist-wrapper:hover .playlist-panel, 
               .playlist-panel.setup-mode {
                    transform: translateX(0);
                    margin-left: -20px;
               }

                h3 { font-size: 1.1rem; color: #fff; }

                .list-container {
                    flex: 1;
                    overflow-y: auto;
                }
                .list-container::-webkit-scrollbar { width: 6px; }
                .list-container::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }

                .playlist-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: background 0.2s;
                    margin-bottom: 4px; /* MUST MATCH ITEM_HEIGHT CALC */
                    height: 64px; /* Force height including padding? No, standard box model. */
                    box-sizing: border-box; 
                    height: 64px; /* 68 total with margin */
                }
                .playlist-item:hover {
                    background: rgba(255,255,255,0.1);
                }
                .playlist-item.active {
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                }

                .thumb {
                    width: 48px;
                    height: 48px;
                    background: #000;
                    border-radius: 4px;
                    overflow: hidden;
                    flex-shrink: 0;
                    position: relative; /* For viewed overlay */
                }
                .thumb img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    opacity: 0;
                    animation: fadeIn 0.3s forwards;
                }
                .viewed-overlay {
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.5);
                    display: flex; align-items: center; justify-content: center;
                }
                @keyframes fadeIn { to { opacity: 1; } }

                .meta {
                    flex: 1;
                    overflow: hidden;
                }
                .name {
                    white-space: nowrap;
                    overflow: hidden;
                    font-size: 0.9rem;
                    color: #eee;
                }
            `}</style>
        </div>
    );
};

export default PlaylistPanel;
