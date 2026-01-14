import React, { useState, useEffect, useMemo } from 'react';
import { eagleService } from '../services/eagle';
import { Search, Check, Filter } from 'lucide-react';

const TagSelector = ({ initialTags = [], onSave, onClose }) => {
    const [tagGroups, setTagGroups] = useState([]);
    const [tags, setTags] = useState([]);
    const [selectedTags, setSelectedTags] = useState(initialTags);
    const [selectedGroup, setSelectedGroup] = useState('All Tags');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        eagleService.getLibraryInfo().then(data => {
            if (data && data.data) {
                setTags(data.data.tags || []);
                setTagGroups(data.data.tagsGroups || []);
            }
        }).finally(() => {
            setLoading(false);
        });
    }, []);

    const allGroupTags = useMemo(() => {
        const uniqueTags = new Set(tagGroups.flatMap(g => g.tags));
        // Also include tags not in any group if necessary, but 'tags' usually has all.
        // If 'tags' list exists, use that as source of truth for "All", 
        // but 'tagGroups' is useful for the "All Grouped Tags" view.
        // Let's rely on the flat 'tags' list for "All Tags" if possible.
        return tags.length > 0 ? tags : Array.from(uniqueTags).sort();
    }, [tagGroups, tags]);

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
    }, [tags, tagGroups, selectedGroup, selectedTags, searchQuery, allGroupTags]);

    const handleSave = () => {
        if (onSave) onSave(selectedTags);
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            height: '400px', width: '600px',
            background: 'rgba(20, 20, 20, 0.95)',
            border: '1px solid #444',
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
            overflow: 'hidden',
            color: 'white'
        }}>
            <div style={{ padding: 10, borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Select Default Tags</h3>
                {onClose && (
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>
                        ✕
                    </button>
                )}
            </div>

            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
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
                            borderRadius: 4,
                            boxSizing: 'border-box'
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
                        {loading && <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>Loading...</div>}
                        {!loading && displayedTags.length === 0 && (
                            <div style={{ padding: 20, color: '#666', textAlign: 'center' }}>No tags found.</div>
                        )}
                        {!loading && displayedTags.map(t => {
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
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div style={{ padding: 10, borderTop: '1px solid #333', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                    onClick={onClose}
                    style={{
                        padding: '8px 16px',
                        background: 'transparent',
                        color: '#aaa',
                        border: '1px solid #444',
                        borderRadius: 4,
                        cursor: 'pointer'
                    }}
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={selectedTags.length === 0}
                    style={{
                        padding: '8px 16px',
                        background: selectedTags.length === 0 ? '#333' : 'var(--accent, #4a9eff)',
                        color: selectedTags.length === 0 ? '#666' : 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: selectedTags.length === 0 ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    Save & Apply
                </button>
            </div>
        </div>
    );
};

export default TagSelector;
