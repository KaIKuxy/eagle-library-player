import React, { useEffect, useRef } from 'react';

const ResizeHandles = () => {
    const isResizing = useRef(false);
    const direction = useRef('');

    useEffect(() => {
        const handleMouseUp = () => {
            isResizing.current = false;
            document.body.style.cursor = 'default';
        };

        const handleMouseMove = (e) => {
            if (!isResizing.current) return;

            // Send resize delta/direction to main process
            // Simply sending raw mouse position or delta might be erratic via IPC
            // Better: send the "drag" intent. 
            // Actually, Electron main process can poll mouse? No.
            // Easiest: Send "resize-window" with { x: e.screenX, y: e.screenY } and letting Main calculate?
            // Or Renderer calculates desired new bounds.

            // Let's rely on Main Process handling the "resize" action if we just say "start-resizing" and passing mouse data?
            // Standard approach:
            // Renderer: "sizing", Main: "win.setBounds"

            // To keep it simple and smooth:
            // We will perform the calculation in Renderer (since we know window size? No, we need current bounds).
            // Let's try sending a generic "resize" command with the edge.
            // But `ipcRenderer` is async-ish.

            // ALTERNATIVE: Use CSS `app-region: drag` is only for moving.
            // Windows 10/11 supports resizing frameless if we handle `WM_NCHITTEST` in main process.
            // Since we can't easily do native code here, let's use the React-driven resize.

            if (window.electron) {
                window.electron.resize(direction.current, { x: e.movementX, y: e.movementY });
            }
        };

        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    const startResize = (dir) => (e) => {
        if (document.fullscreenElement) return;
        isResizing.current = true;
        direction.current = dir;
        document.body.style.cursor = dir + '-resize';
        e.preventDefault(); // Prevent text selection
    };

    const styles = {
        edge: { position: 'fixed', zIndex: 9999 },
        n: { top: 0, left: 10, right: 10, height: 5, cursor: 'n-resize' }, // Leave corners
        s: { bottom: 0, left: 10, right: 10, height: 5, cursor: 's-resize' },
        e: { top: 10, bottom: 10, right: 0, width: 5, cursor: 'e-resize' },
        w: { top: 10, bottom: 10, left: 0, width: 5, cursor: 'w-resize' },
        nw: { top: 0, left: 0, width: 10, height: 10, cursor: 'nw-resize' },
        ne: { top: 0, right: 0, width: 10, height: 10, cursor: 'ne-resize' },
        sw: { bottom: 0, left: 0, width: 10, height: 10, cursor: 'sw-resize' },
        se: { bottom: 0, right: 0, width: 20, height: 20, cursor: 'se-resize', background: 'rgba(255,255,255,0.1)' } // Visual cue on corner?
    };

    return (
        <>
            <div style={{ ...styles.edge, ...styles.n }} onMouseDown={startResize('top')} />
            <div style={{ ...styles.edge, ...styles.s }} onMouseDown={startResize('bottom')} />
            <div style={{ ...styles.edge, ...styles.e }} onMouseDown={startResize('right')} />
            <div style={{ ...styles.edge, ...styles.w }} onMouseDown={startResize('left')} />
            <div style={{ ...styles.edge, ...styles.nw }} onMouseDown={startResize('top-left')} />
            <div style={{ ...styles.edge, ...styles.ne }} onMouseDown={startResize('top-right')} />
            <div style={{ ...styles.edge, ...styles.sw }} onMouseDown={startResize('bottom-left')} />
            <div style={{ ...styles.edge, ...styles.se }} onMouseDown={startResize('bottom-right')} />
        </>
    );
};

export default ResizeHandles;
