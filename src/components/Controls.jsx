import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, List, Volume2, Search, Pin, PinOff, X, Heart } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useToastStore } from '../store/toastStore';
import { eagleService } from '../services/eagle';
import TagSelector from './TagSelector';

const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const Controls = () => {
    const {
        isPlaying, togglePlay, next, previous,
        volume, setVolume, playlist, currentIndex,
        currentTime, duration, requestSeek,
        updateItemTags, likeTags, setLikeTags
    } = usePlayerStore();

    const [isPinned, setIsPinned] = useState(false);
    const [isUpdatingTag, setIsUpdatingTag] = useState(false);
    const [showTagSelector, setShowTagSelector] = useState(false);
    const [selectorPos, setSelectorPos] = useState(null);
    const [popupReason, setPopupReason] = useState(null);
    const heartRef = useRef(null);
    const { addToast } = useToastStore();


    const currentItem = playlist[currentIndex];

    // Scrubbing Logic
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [scrubTime, setScrubTime] = useState(0);

    useEffect(() => {
        if (!isScrubbing) {
            setScrubTime(currentTime);
        }
    }, [currentTime, isScrubbing]);

    const handleScrubStart = () => {
        setIsScrubbing(true);
    };

    const handleScrubChange = (e) => {
        setScrubTime(parseFloat(e.target.value));
    };

    const handleScrubEnd = (e) => {
        setIsScrubbing(false);
        const finalTime = parseFloat(e.target.value);
        requestSeek(finalTime);
    };

    const togglePin = async () => {
        if (window.electron && window.electron.toggleAlwaysOnTop) {
            const newState = await window.electron.toggleAlwaysOnTop();
            setIsPinned(newState);
        }
    };

    const handleClose = () => {
        if (window.electron && window.electron.close) {
            window.electron.close();
        }
    };

    const updateSelectorPosition = () => {
        if (heartRef.current) {
            const rect = heartRef.current.getBoundingClientRect();
            const width = 600; // TagSelector width
            const height = 400; // TagSelector height
            const gap = 15;

            let left = rect.left + (rect.width / 2) - (width / 2);
            let top = rect.top - height - gap;

            // Clamp horizontal
            if (left < 10) left = 10;
            if (left + width > window.innerWidth - 10) left = window.innerWidth - width - 10;

            // Clamp vertical (if button is too high, show below?)
            // Assuming controls are always at bottom for now.
            if (top < 10) top = 10;

            setSelectorPos({ top, left });
        }
    };

    const isLiked = useMemo(() => {
        if (!currentItem || likeTags.length === 0) return false;
        return likeTags.every(tag => currentItem.tags?.includes(tag));
    }, [currentItem, likeTags]);

    const handleHeartClick = async () => {
        if (!currentItem || isUpdatingTag) return;

        // If no tags setup, open setup
        if (likeTags.length === 0) {
            setPopupReason('click');
            updateSelectorPosition();
            setShowTagSelector(true);
            return;
        }

        // Toggle Tags
        setIsUpdatingTag(true);
        try {
            let updatedItem;
            if (isLiked) {
                // UNLIKE: Remove tags (UPDATED LOGIC FROM PREVIOUS STEP IS PRESERVED HERE IF I DON'T OVERWRITE IT, 
                // BUT I AM REPLACING THE WHOLE BLOCK handlesHeartClick so I MUST include the previous logic)
                updatedItem = await eagleService.removeTags(currentItem, likeTags);
                if (updatedItem && updatedItem.tags) {
                    updateItemTags(currentItem.id, updatedItem.tags);
                    addToast("Removed from Favorites", "info");
                }
            } else {
                // LIKE: Add tags
                updatedItem = await eagleService.addTags(currentItem, likeTags);
                if (updatedItem && updatedItem.tags) {
                    updateItemTags(currentItem.id, updatedItem.tags);
                    addToast("Added to Favorites", "success");
                }
            }
        } catch (e) {
            console.error(e);
            addToast("Failed to update tags", "error");
        } finally {
            setIsUpdatingTag(false);
        }
    };

    const handleHeartContextMenu = (e) => {
        e.preventDefault();
        setPopupReason('context');
        updateSelectorPosition();
        setShowTagSelector(true);
    };

    const handleTagSave = async (tags) => {
        setLikeTags(tags);
        setShowTagSelector(false);

        // If triggered by a left-click (attempt to like), perform the like action now with new tags
        if (popupReason === 'click' && currentItem && tags.length > 0) {
            setIsUpdatingTag(true);
            try {
                const updatedItem = await eagleService.addTags(currentItem, tags);
                if (updatedItem && updatedItem.tags) {
                    updateItemTags(currentItem.id, updatedItem.tags);
                    addToast("Added to Favorites", "success");
                }
            } catch (e) {
                console.error(e);
                addToast("Failed to add tags", "error");
            } finally {
                setIsUpdatingTag(false);
            }
        }
    };

    // Determine if video
    const isVideo = currentItem?.ext && ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(currentItem.ext.toLowerCase());


    return (
        <>
            <div className="controls-panel">
                {/* Progress Bar for Video and Images */}
                {currentItem && (
                    <div className="progress-bar-container">
                        <span className="time-display">{formatTime(scrubTime)}</span>
                        <input
                            type="range"
                            className="progress-slider"
                            min="0"
                            max={duration || 100}
                            step="0.1"
                            value={scrubTime}
                            onMouseDown={handleScrubStart}
                            onChange={handleScrubChange}
                            onMouseUp={handleScrubEnd}
                        />
                        <span className="time-display">{formatTime(duration)}</span>
                    </div>
                )}

                {/* Title in Controls */}
                <div style={{ textAlign: 'center', marginBottom: 10, color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%', margin: '0 auto' }}>
                        {currentItem?.name}
                    </div>
                </div>

                <div className="controls-row">
                    <div className="center-controls">
                        <button onClick={previous} title="Previous"><SkipBack size={24} /></button>

                        <button onClick={togglePlay} className="play-btn">
                            {isPlaying ? <Pause size={32} /> : <Play size={32} />}
                        </button>

                        <button onClick={next} title="Next"><SkipForward size={24} /></button>

                        <button
                            ref={heartRef}
                            onClick={handleHeartClick}
                            onContextMenu={handleHeartContextMenu}
                            disabled={isUpdatingTag}
                            title={likeTags.length === 0 ? "Setup Favorites" : (isLiked ? "Saved" : "Save to Favorites")}
                            style={{ color: isLiked ? '#ff4081' : 'white', opacity: isUpdatingTag ? 0.5 : 1 }}
                        >
                            <Heart size={20} fill={isLiked ? "#ff4081" : "none"} />
                        </button>

                        <div className="volume-control">
                            <Volume2 size={20} />
                            <input
                                type="range"
                                min="0" max="1" step="0.05"
                                value={volume}
                                onChange={(e) => setVolume(parseFloat(e.target.value))}
                                className="volume-slider"
                            />
                        </div>

                        <div className="spacer" style={{ width: 20 }} />




                        <button
                            onClick={togglePin}
                            title={isPinned ? "Unpin from Top" : "Pin to Top"}
                            style={{ color: isPinned ? 'var(--accent, #4a9eff)' : 'white' }}
                        >
                            {isPinned ? <Pin size={20} fill="currentColor" /> : <Pin size={20} />}
                        </button>
                    </div>

                    <div style={{ gridColumn: 3, justifySelf: 'end' }}>
                        <button
                            onClick={handleClose}
                            title="Close App"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <style>{`
                    .controls-panel {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        width: 100%;
                        background: linear-gradient(to top, rgba(0,0,0,0.95) 10%, transparent);
                        display: flex;
                        flex-direction: column;
                        justify-content: flex-end;
                        padding: 20px;
                        padding-top: 50px; /* Gradient fade space */
                        opacity: 0;
                        transition: opacity 0.3s;
                        pointer-events: none; 
                        box-sizing: border-box;
                        z-index: 2100; /* Above mini-bar */
                    }
                    .controls-panel:hover {
                        opacity: 1;
                        pointer-events: auto;
                    }
                    .controls-panel:hover > * {
                        pointer-events: auto;
                    }
                    /* Hide mini-bar when controls are hovered (using sibling selector) */
                    .controls-panel:hover + .mini-progress-bar {
                        opacity: 0;
                    }
                    
                    .progress-bar-container {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        width: 90%;
                        max-width: 800px;
                        margin: 0 auto 10px auto;
                        color: #ddd;
                        font-size: 0.85rem;
                        font-family: monospace;
                        pointer-events: auto;
                    }
                    .progress-slider {
                        flex: 1;
                        cursor: pointer;
                        height: 5px;
                        accent-color: var(--accent, #4a9eff);
                    }

                    .controls-row {
                        display: grid;
                        grid-template-columns: 1fr auto 1fr;
                        align-items: center;
                        width: 100%;
                        pointer-events: auto;
                    }

                    .center-controls {
                        grid-column: 2;
                        display: flex;
                        align-items: center;
                        gap: 20px;
                    }
                    
                    button {
                        background: none;
                        border: none;
                        color: white;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    button:hover {
                        color: var(--accent, #4a9eff);
                    }
                    .icon-subtle { opacity: 0.5; }
                    .spacer { flex: 1; }
                    .volume-control { display: flex; align-items: center; gap: 10px; }
                    .volume-slider { width: 80px; accent-color: var(--accent, #4a9eff); }
                    


                `}</style>
            </div>

            {/* Tag Selector Modal */}
            {showTagSelector && selectorPos && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, width: '100%', height: '100%',
                    background: 'transparent', // Transparent backdrop
                    zIndex: 3000,
                    pointerEvents: 'auto'
                }} onClick={() => setShowTagSelector(false)}>

                    <div
                        style={{
                            position: 'absolute',
                            top: selectorPos.top,
                            left: selectorPos.left,
                            // Shadow to separate from background
                            filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <TagSelector
                            initialTags={likeTags}
                            onSave={handleTagSave}
                            onClose={() => setShowTagSelector(false)}
                        />
                    </div>
                </div>
            )}

            {/* Persistent Mini Progress Bar */}
            <div className="mini-progress-bar" style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                width: '100%',
                height: '4px',
                background: 'rgba(255,255,255,0.1)',
                pointerEvents: 'none',
                zIndex: 2000,
                transition: 'opacity 0.3s'
            }}>
                <div style={{
                    width: `${(currentTime / (duration || 1)) * 100}%`,
                    height: '100%',
                    background: 'var(--accent, #4a9eff)',
                    transition: 'width 0.2s linear'
                }} />
            </div>
        </>
    );
};

export default Controls;
