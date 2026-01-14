import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { eagleService } from '../services/eagle';

const Player = () => {
    // Selective subscriptions to prevent re-renders on 'currentTime' updates
    const playlist = usePlayerStore(state => state.playlist);
    const currentIndex = usePlayerStore(state => state.currentIndex);
    const isPlaying = usePlayerStore(state => state.isPlaying);
    const volume = usePlayerStore(state => state.volume);
    const seekToTime = usePlayerStore(state => state.seekToTime);
    const libraryPath = usePlayerStore(state => state.libraryPath); // Force re-render on library path update

    // Actions (stable)
    const next = usePlayerStore(state => state.next);
    const updateProgress = usePlayerStore(state => state.updateProgress);
    const consumeSeek = usePlayerStore(state => state.consumeSeek);
    const togglePlay = usePlayerStore(state => state.togglePlay);

    const videoRef = useRef(null);
    const [_progress, _setProgress] = useState(0); // For image timer (local state) - Unused now
    const currentItem = playlist[currentIndex];

    // Dedicated refs for image logic
    const imageTimeRef = useRef(0);
    const intervalRef = useRef(null);
    const IMAGE_DURATION = 10;

    // Media Attributes
    const isVideo = currentItem?.ext === 'mp4' || currentItem?.ext === 'webm' || currentItem?.ext === 'mov';
    const src = eagleService.getItemSrc(currentItem);

    // Volume Sync
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = volume;
        }
    }, [volume]);

    // Seek Sync
    useEffect(() => {
        if (seekToTime !== null && videoRef.current) {
            videoRef.current.currentTime = seekToTime;
            consumeSeek();
        }
    }, [seekToTime, consumeSeek]);

    // Reset image timer when item changes
    useEffect(() => {
        if (!isVideo) {
            imageTimeRef.current = 0;
            updateProgress(0, IMAGE_DURATION);
        }
    }, [currentItem?.id, isVideo, updateProgress]);

    // Play/Pause Sync
    useEffect(() => {
        if (!currentItem) return;

        if (isVideo) {
            if (videoRef.current) {
                if (isPlaying) {
                    videoRef.current.play().catch(e => console.log("Autoplay blocked", e));
                } else {
                    videoRef.current.pause();
                }
            }
        } else {
            // Image Logic
            if (isPlaying) {
                const intervalStep = 100;
                if (intervalRef.current) clearInterval(intervalRef.current);

                intervalRef.current = setInterval(() => {
                    imageTimeRef.current = (imageTimeRef.current || 0) + (intervalStep / 1000);

                    updateProgress(imageTimeRef.current, IMAGE_DURATION);

                    if (imageTimeRef.current >= IMAGE_DURATION) {
                        clearInterval(intervalRef.current);
                        next();
                    }
                }, intervalStep);
            } else {
                if (intervalRef.current) clearInterval(intervalRef.current);
            }
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isPlaying, currentItem, next, isVideo, updateProgress]);

    // Custom Drag Logic (to allow Double Click)
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        if (e.button !== 0) return;
        isDragging.current = true;
        dragStart.current = { x: e.screenX, y: e.screenY };
    };

    const handleMouseMove = (e) => {
        if (!isDragging.current) return;
        const deltaX = e.screenX - dragStart.current.x;
        const deltaY = e.screenY - dragStart.current.y;

        if (window.electron && (deltaX !== 0 || deltaY !== 0)) {
            window.electron.moveWindow({ x: deltaX, y: deltaY });
            dragStart.current = { x: e.screenX, y: e.screenY };
        }
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    // Title Overlay Logic
    const [showTitle, setShowTitle] = useState(false);
    useEffect(() => {
        setShowTitle(true);
        const timer = setTimeout(() => setShowTitle(false), 2000);
        return () => clearTimeout(timer);
    }, [currentItem]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space') {
                e.preventDefault(); // Prevent scrolling
                togglePlay();
            }
            if (e.key === 'Enter') {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(err => {
                        console.log(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                    });
                } else {
                    document.exitFullscreen();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay]);

    return (
        <div
            className="player-container"
            style={{ width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'black', position: 'relative' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={() => togglePlay()}
        >
            {/* Title Overlay */}
            <div style={{
                position: 'absolute', top: 40, left: 0, width: '100%',
                textAlign: 'center', pointerEvents: 'none',
                opacity: showTitle ? 1 : 0, transition: 'opacity 0.5s',
                textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                zIndex: 50
            }}>
                <h1 style={{ fontSize: '1.5rem', margin: 0, color: 'white' }}>{currentItem?.name}</h1>
            </div>

            {currentItem ? (
                isVideo ? (
                    <video
                        draggable={false}
                        ref={videoRef}
                        src={src}
                        autoPlay={isPlaying}
                        className="media-item"
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                        }}
                        onEnded={next}
                        onTimeUpdate={(e) => updateProgress(e.target.currentTime, e.target.duration)}
                        onLoadedMetadata={(e) => updateProgress(e.target.currentTime, e.target.duration)}
                    />
                ) : (
                    <img
                        draggable={false}
                        src={src}
                        alt={currentItem.name}
                        className="media-item"
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                        }}
                    />
                )
            ) : (
                <div className="placeholder" style={{ color: 'white', pointerEvents: 'none' }}>No Media Selected</div>
            )}
        </div>
    );
};

export default Player;
