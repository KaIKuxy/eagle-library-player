const EAGLE_API_URL = 'http://localhost:41595/api';
let cachedLibraryPath = '';

export const eagleService = {
    // Fetch Library Info (Folders, Smart Folders, Tags)
    getLibraryInfo: async () => {
        try {
            const response = await fetch(`${EAGLE_API_URL}/library/info`);
            const data = await response.json();
            if (data && data.data && data.data.library && data.data.library.path) {
                cachedLibraryPath = data.data.library.path.replace(/\\/g, '/') + '/images';
            }
            return data;
        } catch (error) {
            console.error('Available Eagle library not found', error);
            return null;
        }
    },

    getFolderList: async () => {
        try {
            const response = await fetch(`${EAGLE_API_URL}/folder/list`);
            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error('Failed to fetch folder list', error);
            return [];
        }
    },



    // Fetch Items with filters
    getItems: async ({ folders, tags, dateRange, orderBy = 'CREATEDATE' }) => {
        // "folders" can be Smart Folder ID or Folder ID. 
        // "tags" is array of strings.
        // "dateRange" needs custom handling if Eagle API supports it via "annotation" or internal filtering, 
        // but typically we filter by "folders" (Smart Folder) or use "list" with queries.
        // Standard /api/item/list allows various filters.

        // Construct Query
        const params = new URLSearchParams();
        if (folders) params.append('folders', folders);
        // Note: Multiple tags might need separate handling or specific query param format depending on API version.
        // Usually it's ?tags=A,B or ?tags=A&tags=B. We'll assume comma separated or handle logic in store if complex.

        // For date range, we might simply fetch recent items if "smart folder" isn't used.
        // Eagle API `item/list` params: keyword, ext, tags, folders, offset, limit, orderBy.

        let url = `${EAGLE_API_URL}/item/list?limit=1000000`; // Fetch huge batch
        if (folders) url += `&folders=${folders}`;
        if (orderBy) url += `&orderBy=${orderBy}`;

        // Fetching
        try {
            const response = await fetch(url);
            const result = await response.json();
            let items = result.data || [];

            // Client-side filtering for complex tag "AND" logic or Date ranges if API is limited
            if (tags && tags.length > 0) {
                items = items.filter(item =>
                    tags.every(tag => item.tags.includes(tag))
                );
            }

            if (dateRange) {
                // Timestamp handling (ms)
                const now = Date.now();
                items = items.filter(item => {
                    // modificationTime or lastModified?
                    // Eagle item: modificationTime
                    return (now - item.modificationTime) <= dateRange;
                });
            }

            return items;
        } catch (error) {
            console.error('Failed to items', error);
            return [];
        }
    },

    // Helper to get media src (using our local proxy)
    // Helper to get media src (using Electron custom protocol)
    getItemSrc: (item) => {
        if (!item || !cachedLibraryPath) return '';
        // Custom Protocol: local-media://Z:/path -> Decoded in Main
        // Use triple slash to prevent drive letter colon stripping (browser normalization)
        // local-media:///Z:/...
        const fileName = item.name + '.' + item.ext;
        const fullPath = `${cachedLibraryPath}/${item.id}.info/${fileName}`;

        // Encode URI to handle special characters safely in URL
        return `local-media:///${encodeURI(fullPath)}`;
    },

    getItemThumbnail: (item) => {
        if (!item || !cachedLibraryPath) return '';
        // Thumbnails are usually Name_thumbnail.png
        const thumbName = item.name + '_thumbnail.png';
        const fullPath = `${cachedLibraryPath}/${item.id}.info/${thumbName}`;
        return `local-media:///${encodeURI(fullPath)}`;
    },

    // Fetch single item info
    getItemById: async (id) => {
        try {
            const response = await fetch(`${EAGLE_API_URL}/item/info?id=${id}`);
            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Failed to fetch item info', error);
            return null;
        }
    },

    // Update item tags safely
    reuploadItemTags: async (item, newTag) => {
        return eagleService.addTags(item, [newTag]);
    },

    addTags: async (item, tagsToAdd) => {
        if (!item?.id || !tagsToAdd || tagsToAdd.length === 0) return null;

        try {
            // 1. Fetch latest to ensure concurrency safety
            const latestItem = await eagleService.getItemById(item.id);
            if (!latestItem) throw new Error("Item not found");

            // 2. Merge Tags
            const currentTags = new Set(latestItem.tags);
            let changed = false;
            tagsToAdd.forEach(t => {
                if (!currentTags.has(t)) {
                    currentTags.add(t);
                    changed = true;
                }
            });

            if (!changed) return latestItem;

            // 3. Update
            const newTags = Array.from(currentTags);
            let result;
            if (window.electron && window.electron.updateItemTags) {
                // Use IPC to bypass CORS
                result = await window.electron.updateItemTags(item.id, newTags);
            } else {
                // Fallback (Will likely fail CORS in browser)
                const response = await fetch(`${EAGLE_API_URL}/item/update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: item.id,
                        tags: newTags
                    })
                });
                result = await response.json();
            }

            if (result.status === 'success') {
                return result.data;
            } else {
                throw new Error("Update failed");
            }

        } catch (e) {
            console.error("Failed to add tags:", e);
            throw e;
        }
    },

    removeTags: async (item, tagsToRemove) => {
        if (!item?.id || !tagsToRemove || tagsToRemove.length === 0) return null;

        try {
            // 1. Fetch latest
            const latestItem = await eagleService.getItemById(item.id);
            if (!latestItem) throw new Error("Item not found");

            // 2. Remove Tags
            const currentTags = new Set(latestItem.tags);
            let changed = false;
            tagsToRemove.forEach(t => {
                if (currentTags.has(t)) {
                    currentTags.delete(t);
                    changed = true;
                }
            });

            if (!changed) return latestItem;

            // 3. Update
            const newTags = Array.from(currentTags);
            let result;
            if (window.electron && window.electron.updateItemTags) {
                result = await window.electron.updateItemTags(item.id, newTags);
            } else {
                const response = await fetch(`${EAGLE_API_URL}/item/update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: item.id, tags: newTags })
                });
                result = await response.json();
            }

            if (result.status === 'success') {
                return result.data;
            } else {
                throw new Error("Update failed");
            }

        } catch (e) {
            console.error("Failed to remove tags:", e);
            throw e;
        }
    }
};
