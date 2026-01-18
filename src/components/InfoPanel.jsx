import React, { useState } from 'react';
import { usePlayerStore } from '../store/playerStore';

const InfoPanel = () => {
    const playlist = usePlayerStore(state => state.playlist);
    const currentIndex = usePlayerStore(state => state.currentIndex);
    const folderIdNameMap = usePlayerStore(state => state.folderIdNameMap);
    const currentItem = playlist[currentIndex];
    const [isHovered, setIsHovered] = useState(false);

    if (!currentItem) return null;

    return (
        <div
            className="info-wrapper"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="trigger-area" />
            <div className="info-panel">
                <h2>{currentItem.name}</h2>
                <p style={{ fontSize: '0.9em', color: '#999', marginBottom: 20 }}>
                    Item {currentIndex + 1} of {playlist.length}
                </p>

                <div className="info-section">
                    <label>Folders</label>
                    <div className="tags">
                        {currentItem.folders?.map(f => <span key={f} className="tag">{folderIdNameMap?.[f] || f}</span>)}
                    </div>
                </div>

                <div className="info-section">
                    <label>Tags</label>
                    <div className="tags">
                        {currentItem.tags?.map(t => <span key={t} className="tag">{t}</span>)}
                    </div>
                </div>
            </div>

            <style>{`
                .info-wrapper {
                    position: fixed;
                    top: 0;
                    right: 0;
                    height: calc(100% - 130px);
                    z-index: 90;
                    display: flex;
                    flex-direction: row-reverse; /* Trigger on right, Panel on Left */
                }
                .trigger-area {
                    width: 20px;
                    height: 100%;
                }
                .info-panel {
                    width: 300px;
                    height: 100%;
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(10px);
                    padding: 20px;
                    /* Fully hidden: Move to Right */
                    transform: translateX(100%);
                    transition: transform 0.3s ease;
                    border-left: 1px solid rgba(255,255,255,0.1);
                    color: white;
                    /* Visual Hack: To ensure it connects with trigger if needed, 
                       but since trigger is 20px at Right:0, Panel starts at Right: 20px. 
                       TranslateX 100% of 300px = +300px Right. Correct.
                       When Hover: TranslateX(0) */
                    margin-right: -20px; /* Pull it slightly into the trigger area to mimic PlaylistPanel behavior */
                }
                
                .info-wrapper:hover .info-panel {
                    transform: translateX(0);
                    margin-right: -20px;
                }
                
                h2 { margin-bottom: 20px; font-size: 1.1rem; color: #fff; word-break: break-word; }
                .info-section { margin-bottom: 20px; }
                .info-section label { display: block; margin-bottom: 8px; color: #aaa; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; }
                .tags { display: flex; flex-wrap: wrap; gap: 8px; }
                .tag { 
                    background: rgba(255,255,255,0.1); 
                    padding: 4px 8px; 
                    border-radius: 4px; 
                    font-size: 0.8rem;
                    color: #ddd;
                    word-break: break-word;
                }
            `}</style>
        </div>
    );
};

export default InfoPanel;
