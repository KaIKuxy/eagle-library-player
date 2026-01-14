import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { eagleService } from '../services/eagle';
import { checkSmartFilter } from '../utils/smartFilter';
import { Search, Loader2, Check, Filter, ListFilter } from 'lucide-react';

const ALLOWED_EXTENSIONS = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp',
    'mp4', 'webm', 'avi', 'mov', 'mkv'
];

const PlaylistSetup = ({ onSetupComplete }) => {
    const [folders, setFolders] = useState([]);
    const [tagGroups, setTagGroups] = useState([]); // New: Tag Groups
    const [tags, setTags] = useState([]); // All available tags (flat list)

    // Tag Filter State
    const [selectedTags, setSelectedTags] = useState([]); // UI Selection
    const [activeTags, setActiveTags] = useState([]); // Actual query tags (Deferred)
    const [selectedGroup, setSelectedGroup] = useState('All Tags'); // 'All Tags', 'Selected', or Specific Group Name
    const [searchQuery, setSearchQuery] = useState('');

    const [selectedFolderId, setSelectedFolderId] = useState(null);
    const [selectedDateRange, setSelectedDateRange] = useState(undefined); // Default: None
    const [activeTab, setActiveTab] = useState('tags'); // smart, tags, date
    const [previewCount, setPreviewCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [fetchingLibrary, setFetchingLibrary] = useState(true);
    const [calculatingPreview, setCalculatingPreview] = useState(false);

    // Cache for the FINAL processed items (Fetched -> Filtered -> Sorted)
    const [cachedItems, setCachedItems] = useState([]);

    useEffect(() => {
        // Load library info
        setFetchingLibrary(true);
        eagleService.getLibraryInfo().then(data => {
            console.log('Eagle Library Info Raw:', data);
            if (data && data.data) {
                // User confirmed rules are in library/info
                const smartFolders = data.data.smartFolders || [];
                console.log('Smart Folders Found:', smartFolders.length);

                setFolders(smartFolders);
                setTags(data.data.tags || []);
                setTagGroups(data.data.tagsGroups || []);
            }
        }).finally(() => {
            setFetchingLibrary(false);
        });
    }, []);

    // Helper to compare folder sets
    const getFolderKey = useCallback((item) => {
        if (!item.folders || !Array.isArray(item.folders)) return '';
        return [...item.folders].sort().join(',');
    }, []);

    const reorderPlaylistItems = useCallback((allItems) => {
        const t0 = performance.now();
        if (!allItems || allItems.length === 0) return [];

        const sortedPlaylist = [];
        let currentGroup = [];
        let previousKey = null;

        for (const item of allItems) {
            const currentKey = getFolderKey(item);

            if (previousKey !== null && currentKey !== previousKey) {
                // Group ended, sort and flush
                currentGroup.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
                sortedPlaylist.push(...currentGroup);
                currentGroup = [];
            }

            currentGroup.push(item);
            previousKey = currentKey;
        }

        // Flush last group
        if (currentGroup.length > 0) {
            currentGroup.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            sortedPlaylist.push(...currentGroup);
        }

        const t1 = performance.now();
        console.log(`[Profile] Reorder Logic took ${(t1 - t0).toFixed(2)}ms for ${allItems.length} items`);
        return sortedPlaylist;
    }, [getFolderKey]);

    // Effect to preview count when selection changes
    // NOW ALSO PERFORMS: Filtering & Sorting
    useEffect(() => {
        const check = async () => {
            setCalculatingPreview(true);
            setCachedItems([]); // Clear cache while fetching
            let items = [];
            try {
                const tFetchStart = performance.now();
                if (activeTab === 'tags') {
                    if (activeTags.length > 0) {
                        items = await eagleService.getItems({ tags: activeTags });
                    }
                } else if (activeTab === 'smart') {
                    if (selectedFolderId) {
                        // CLIENT-SIDE FILTERING for Smart Folders
                        // 1. Fetch ALL items
                        let allItems = await eagleService.getItems({});

                        // 2. Find the smart folder definition
                        const smartFolder = folders.find(f => f.id === selectedFolderId);

                        // 3. Filter
                        if (smartFolder && allItems.length > 0) {
                            items = allItems.filter(item => checkSmartFilter(smartFolder, item));
                        } else {
                            items = []; // Folder not found or no items
                        }
                    }
                } else if (activeTab === 'date') {
                    if (selectedDateRange !== undefined) {
                        if (selectedDateRange !== null) {
                            items = await eagleService.getItems({ dateRange: selectedDateRange });
                        } else {
                            items = await eagleService.getItems({});
                        }
                    }
                }
                const tFetchEnd = performance.now();
                console.log(`[Profile] Background Fetch took ${(tFetchEnd - tFetchStart).toFixed(2)}ms`);

                // 2. Filter by Allowed Extensions
                const tFilterStart = performance.now();
                items = items.filter(item => {
                    if (!item.ext) return false;
                    return ALLOWED_EXTENSIONS.includes(item.ext.toLowerCase());
                });
                const tFilterEnd = performance.now();
                console.log(`[Profile] Background Filter took ${(tFilterEnd - tFilterStart).toFixed(2)}ms`);

                // 3. Reorder
                // reorderPlaylistItems logs its own time
                items = reorderPlaylistItems(items);

                // Store FINAL processed items in cache
                setCachedItems(items);
                setPreviewCount(items.length); // Count is now "Playable Items"

            } catch (e) {
                console.error('Failed to preview count', e);
                setPreviewCount(0);
                setCachedItems([]);
            } finally {
                setCalculatingPreview(false);
            }
        };

        // Debounce slightly to avoid rapid firing
        const timer = setTimeout(check, 300);
        return () => clearTimeout(timer);
    }, [activeTags, activeTab, selectedFolderId, selectedDateRange, reorderPlaylistItems]);


    const handleStart = async () => {
        // Double check validity before starting
        if (!isSelectionValid) return;

        setLoading(true);
        console.log('[Profile] Starting Playlist Load...');

        try {
            // OPTIMIZATION: Use cached processed items
            // The Button is disabled if caching/calculating is in progress, 
            // so cachedItems MUST be ready here.
            let items = cachedItems;

            if (onSetupComplete) {
                onSetupComplete(items);
            }

            console.log(`[Profile] Process Complete. Instant Load using Cache.`);

        } catch (e) {
            console.error('Error starting playlist:', e);
        } finally {
            setLoading(false);
        }
    };

    // Synchronous Validation
    const isSelectionValid = (() => {
        if (activeTab === 'tags') return activeTags.length > 0;
        if (activeTab === 'smart') return !!selectedFolderId;
        if (activeTab === 'date') return selectedDateRange !== undefined;
        return false;
    })();

    // Helper: Handle Tag Application
    const handleApplyTags = () => {
        setActiveTags(selectedTags);
        setCalculatingPreview(true); // Trigger loading state visually
    };

    // Derived Logic for Tags UI
    const allGroupTags = useMemo(() => {
        const uniqueTags = new Set(tagGroups.flatMap(g => g.tags));
        return Array.from(uniqueTags).sort();
    }, [tagGroups]);

    const displayedTags = useMemo(() => {
        let sourceTags = [];

        if (selectedGroup === 'All Tags') {
            sourceTags = allGroupTags;
        } else if (selectedGroup === 'Selected') {
            sourceTags = selectedTags;
        } else {
            const group = tagGroups.find(g => g.name === selectedGroup);
            sourceTags = group ? group.tags : [];
        }

        if (!searchQuery) return sourceTags;
        return sourceTags.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [tags, tagGroups, selectedGroup, selectedTags, searchQuery]);

    const isDirty = JSON.stringify(selectedTags.slice().sort()) !== JSON.stringify(activeTags.slice().sort());

    const isDisabled = loading || fetchingLibrary || calculatingPreview || !isSelectionValid || (previewCount === 0 && !calculatingPreview) || (activeTab === 'tags' && isDirty);

    const handleTabChange = (tab) => {
        // Reset dependent states if needed? 
        // For now, just set calculatingPreview to true to visually indicate change
        setCalculatingPreview(true);
        setActiveTab(tab);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, color: 'white' }}>
            <div style={{ marginBottom: 15 }}>
                <h3 style={{ margin: 0, marginBottom: 10 }}>Filter Playlist</h3>
                <div className="tabs" style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                    <button
                        onClick={() => handleTabChange('smart')}
                        style={{
                            padding: '4px 8px',
                            background: activeTab === 'smart' ? '#444' : '#222',
                            border: '1px solid #444',
                            color: 'white',
                            cursor: 'pointer',
                            flex: 1
                        }}>
                        Smart
                    </button>
                    <button
                        onClick={() => handleTabChange('tags')}
                        style={{
                            padding: '4px 8px',
                            background: activeTab === 'tags' ? '#444' : '#222',
                            border: '1px solid #444',
                            color: 'white',
                            cursor: 'pointer',
                            flex: 1
                        }}>
                        Tags
                    </button>
                    <button
                        onClick={() => handleTabChange('date')}
                        style={{
                            padding: '4px 8px',
                            background: activeTab === 'date' ? '#444' : '#222',
                            border: '1px solid #444',
                            color: 'white',
                            cursor: 'pointer',
                            flex: 1
                        }}>
                        Date
                    </button>
                </div>
            </div>

            <div className="content" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {fetchingLibrary ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>
                        <p>Loading Library...</p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'tags' && (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                                {/* Search Bar */}
                                <div style={{ padding: '0 0 10px 0', position: 'relative' }}>
                                    <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#aaa' }} />
                                    <input
                                        type="text"
                                        placeholder="Search tags"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 8px 8px 36px',
                                            background: '#222',
                                            border: '1px solid #444',
                                            color: 'white',
                                            borderRadius: 4
                                        }}
                                    />
                                </div>

                                {/* Split View */}
                                <div style={{ display: 'flex', flex: 1, minHeight: 0, border: '1px solid #333', borderRadius: 4 }}>

                                    {/* Left Sidebar: Groups */}
                                    <div style={{
                                        width: '35%',
                                        borderRight: '1px solid #333',
                                        overflowY: 'auto',
                                        background: '#1a1a1a'
                                    }}>
                                        {/* Special Groups */}
                                        <div
                                            onClick={() => setSelectedGroup('Selected')}
                                            style={{
                                                padding: '8px 12px',
                                                cursor: 'pointer',
                                                background: selectedGroup === 'Selected' ? '#333' : 'transparent',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                fontWeight: selectedGroup === 'Selected' ? 'bold' : 'normal'
                                            }}
                                        >
                                            <span>Selected</span>
                                            <span style={{ fontSize: '0.8em', opacity: 0.8 }}>{selectedTags.length}</span>
                                        </div>
                                        <div
                                            onClick={() => setSelectedGroup('All Tags')}
                                            style={{
                                                padding: '8px 12px',
                                                cursor: 'pointer',
                                                background: selectedGroup === 'All Tags' ? 'var(--accent, #4a9eff)' : 'transparent',
                                                color: selectedGroup === 'All Tags' ? 'white' : '#ddd',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                fontWeight: selectedGroup === 'All Tags' ? 'bold' : 'normal'
                                            }}
                                        >
                                            <span>All Tags</span>
                                            <span style={{ fontSize: '0.8em', opacity: 0.8 }}>{allGroupTags.length.toLocaleString()}</span>
                                        </div>

                                        <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '5px 0' }} />

                                        {/* Dynamic Groups */}
                                        {tagGroups.map(group => (
                                            <div
                                                key={group.id}
                                                onClick={() => setSelectedGroup(group.name)}
                                                style={{
                                                    padding: '8px 12px',
                                                    cursor: 'pointer',
                                                    background: selectedGroup === group.name ? '#333' : 'transparent',
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    fontSize: '0.95em'
                                                }}
                                            >
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{group.name}</span>
                                                <span style={{ fontSize: '0.8em', color: '#666' }}>{group.tags.length}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Right Panel: Tags */}
                                    <div style={{ flex: 1, overflowY: 'auto', padding: 5, background: '#111' }}>
                                        {displayedTags.length === 0 && (
                                            <div style={{ padding: 20, color: '#666', textAlign: 'center' }}>No tags found.</div>
                                        )}
                                        {displayedTags.map(t => {
                                            const isSelected = selectedTags.includes(t);
                                            return (
                                                <div
                                                    key={t}
                                                    onClick={() => {
                                                        setSelectedTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
                                                    }}
                                                    style={{
                                                        padding: '6px 10px',
                                                        marginBottom: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 10,
                                                        cursor: 'pointer',
                                                        background: isSelected ? 'rgba(74, 158, 255, 0.1)' : 'transparent',
                                                        borderRadius: 3
                                                    }}
                                                >
                                                    <div style={{
                                                        width: 16, height: 16,
                                                        borderRadius: 3,
                                                        border: isSelected ? 'none' : '1px solid #444',
                                                        background: isSelected ? 'var(--accent, #4a9eff)' : 'transparent',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                        {isSelected && <Check size={12} color="white" />}
                                                    </div>
                                                    <span style={{ color: isSelected ? 'white' : '#aaa', fontSize: '0.95em' }}>{t}</span>
                                                    {/* Optional: Show count per tag if available? Eagle API structure is {name, tags: []}, usually no per-tag count unless we compute it from items (expensive) */}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Apply Button for Tags */}
                                <div style={{ marginTop: 10 }}>
                                    <button
                                        onClick={handleApplyTags}
                                        disabled={!isDirty && activeTags.length > 0}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            background: isDirty ? 'var(--accent, #4a9eff)' : '#333',
                                            color: isDirty ? 'white' : '#777',
                                            border: 'none',
                                            borderRadius: 4,
                                            cursor: isDirty ? 'pointer' : 'default',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                                        }}
                                    >
                                        <Filter size={14} />
                                        {isDirty ? 'Apply Filter' : 'Filter Applied'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'smart' && (
                            <div>
                                <div style={{ marginBottom: 5, color: '#aaa', fontSize: '0.8em' }}>
                                    Found {folders.length} folders.
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {folders.map(f => (
                                        <div
                                            key={f.id}
                                            onClick={() => {
                                                setCalculatingPreview(true);
                                                setSelectedFolderId(f.id);
                                            }}
                                            style={{
                                                padding: '6px 8px',
                                                background: selectedFolderId === f.id ? 'blue' : '#333',
                                                cursor: 'pointer',
                                                borderRadius: 3,
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: '0.9em'
                                            }}
                                        >
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                        </div>
                                    ))}
                                    {folders.length === 0 && <p>No smart folders.</p>}
                                </div>
                            </div>
                        )}

                        {activeTab === 'date' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {[
                                    { label: 'Today', value: 24 * 60 * 60 * 1000 },
                                    { label: 'Last 7 Days', value: 7 * 24 * 60 * 60 * 1000 },
                                    { label: 'Last 30 Days', value: 30 * 24 * 60 * 60 * 1000 },
                                    { label: 'All Time', value: null }
                                ].map(opt => (
                                    <button
                                        key={opt.label}
                                        onClick={() => {
                                            setCalculatingPreview(true);
                                            setSelectedDateRange(opt.value);
                                        }}
                                        style={{
                                            padding: '8px 12px',
                                            background: (selectedDateRange === opt.value) ? 'blue' : '#333',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 3,
                                            cursor: 'pointer',
                                            textAlign: 'left'
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="footer" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #333' }}>
                <div style={{ fontSize: '0.8em', color: '#aaa', marginBottom: 5 }}>
                    {calculatingPreview ? 'Preview: Loading...' : `Preview: ${previewCount} items`}
                </div>
                <button
                    onClick={handleStart}
                    style={{
                        width: '100%',
                        padding: '10px',
                        background: isDisabled ? '#333' : 'blue',
                        color: isDisabled ? '#777' : 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        opacity: isDisabled ? 0.7 : 1
                    }}
                    disabled={isDisabled}
                >
                    {loading ? 'Loading...' : 'Load Playlist'}
                </button>
            </div>
        </div>
    );
};

export default PlaylistSetup;
