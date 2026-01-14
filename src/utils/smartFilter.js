
/**
 * Smart Folder Filtering Utility
 * Rewritten for modern usage and clarity.
 */

// --- Constants ---
const EXTENSIONS = {
    VIDEO: new Set(['mp4', 'mov', 'avi', 'wmv', 'webm', 'mkv', 'm4v', '3gp', 'ts']),
    AUDIO: new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']),
    FONT: new Set(['ttf', 'otf', 'woff', 'ttc']),
    OFFICE: {
        PPT: new Set(['ppt', 'pptx', 'potx', 'key']),
        EXCEL: new Set(['xls', 'xlsx']),
        WORD: new Set(['doc', 'docx'])
    }
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// --- Helper Functions ---

const normalize = (str) => (str || '').toLowerCase();

const StringMatchers = {
    'equal': (a, b) => a === b,
    'startWith': (a, b) => a.startsWith(b),
    'endWith': (a, b) => a.endsWith(b),
    'contain': (a, b) => a.includes(b),
    'uncontain': (a, b) => !a.includes(b),
    'empty': (a) => a === '',
    'not-empty': (a) => a !== '',
    'regex': (a, b) => {
        try { return new RegExp(b, 'g').test(a); } catch { return false; }
    }
};

const matchString = (value, ruleValue, method) => {
    const val = normalize(value);
    const rVal = normalize(ruleValue);

    // Empty checks don't need ruleValue
    if (method === 'empty' || method === 'not-empty') {
        return StringMatchers[method](val);
    }

    if (rVal === '') return false; // Default safe behavior

    const matcher = StringMatchers[method];
    return matcher ? matcher(val, rVal) : false;
};

const matchNumber = (val, [min, max], method) => {
    if (val === undefined || val === null) return false;

    switch (method) {
        case '=': return val === min;
        case '>=': return val >= min;
        case '<=': return val <= min;
        case '>': return val > min;
        case '<': return val < min;
        case 'between': return val >= min && val <= max;
        default: return false;
    }
};

const matchDate = (timestamp, [val1, val2], method) => {
    if (!timestamp) return false;

    // Convert to simple time comparison where appropriate
    // Logic adapted to Eagle's behavior

    switch (method) {
        case 'on':
            return new Date(timestamp).toDateString() === new Date(val1).toDateString();
        case 'before':
            return timestamp <= val1 + MS_PER_DAY;
        case 'after':
            return timestamp >= val1;
        case 'between':
            return val1 <= timestamp && timestamp <= val2 + MS_PER_DAY;
        case 'within':
            // "Within last X days"
            const days = val1;
            return timestamp + (days * MS_PER_DAY) >= Date.now();
        default:
            return false;
    }
};

const matchSet = (itemTags, ruleTags, method) => {
    if (!itemTags) itemTags = [];
    if (method === 'empty') return itemTags.length === 0;
    if (method === 'not-empty') return itemTags.length > 0;

    const intersectionCount = ruleTags.filter(t => itemTags.includes(t)).length;

    switch (method) {
        case 'intersection': // ALL rule tags must be present
        case 'contain': // Ambiguity in naming, but often means "Contains All" in these contexts or "Contains Any"? 
            // Eagle usually treats standard tag search as AND. Let's assume Intersection.
            return intersectionCount === ruleTags.length && ruleTags.length > 0;

        case 'equal': // Exact set match
            return intersectionCount === ruleTags.length && itemTags.length === ruleTags.length;

        case 'union': // ANY match
            return intersectionCount > 0;

        case 'identity': // NONE match (Exclude)
            return intersectionCount === 0;

        default: return false;
    }
};


// --- Property Matchers ---

const Matchers = {
    name: (rule, item) => matchString(item.name, rule.value, rule.method),

    folderName: (rule, item, context) => {
        if (!item.folders?.length) return false;
        // Check if ANY folder matches
        return item.folders.some(folderId => {
            const folder = context.folderMappings?.[folderId];
            return folder && matchString(folder.name, rule.value, rule.method);
        });
    },

    url: (rule, item) => matchString(item.url, rule.value, rule.method),

    annotation: (rule, item) => matchString(item.annotation, rule.value, rule.method),

    comments: (rule, item) => {
        const allComments = (item.comments || []).map(c => c.annotation).join(' ');
        return matchString(allComments, rule.value, rule.method);
    },

    // Numeric Rules
    width: (rule, item) => matchNumber(item.width, rule.value, rule.method),
    height: (rule, item) => matchNumber(item.height, rule.value, rule.method),

    fileSize: (rule, item) => {
        let size = item.size;
        if (rule.unit === 'kb') size /= 1024;
        else size /= (1024 * 1024); // mb
        return matchNumber(size, rule.value, rule.method);
    },

    duration: (rule, item) => {
        let dur = item.duration;
        if (rule.unit === 'm') dur /= 60;
        if (rule.unit === 'h') dur /= 3600;
        return matchNumber(dur, rule.value, rule.method);
    },

    bpm: (rule, item) => matchNumber(item.bpm, rule.value, rule.method),

    rating: (rule, item) => {
        // Eagle rating 0-5. 
        // special methods: equal, unequal, contain ('none', '1', '2'...)
        const val = rule.value;
        const star = item.star || 0; // 0 usually means Unrated in storage

        if (rule.method === 'contain') {
            // value is string array or string "1,2,3,none"
            // if array check include
            const permitted = Array.isArray(val) ? val : [val];
            if (star === 0 || star === undefined) return permitted.includes('none');
            return permitted.includes(String(star)) || permitted.includes(star);
        }

        const target = parseInt(val);
        if (isNaN(target)) { // 'none'
            if (rule.method === 'equal') return !item.star;
            if (rule.method === 'unequal') return !!item.star;
        }

        return matchNumber(star, [target], rule.method);
    },

    // Date Rules
    createTime: (rule, item) => matchDate(item.modificationTime, rule.value, rule.method), // Usually maps to mod time in Eagle for sorting/filtering
    mtime: (rule, item) => matchDate(item.modificationTime, rule.value, rule.method),
    btime: (rule, item) => matchDate(item.btime || item.modificationTime, rule.value, rule.method),

    // Array/Set Rules
    tags: (rule, item) => matchSet(item.tags, rule.value, rule.method),
    folders: (rule, item) => matchSet(item.folders, rule.value, rule.method),

    // Type Rules
    type: (rule, item) => {
        const ext = (item.ext || '').toLowerCase();
        const target = rule.value;

        let isMatch = false;
        if (target === ext) isMatch = true;
        else {
            switch (target) {
                case 'video':
                case 'videos': isMatch = EXTENSIONS.VIDEO.has(ext); break;
                case 'audio': isMatch = EXTENSIONS.AUDIO.has(ext); break;
                case 'font': isMatch = EXTENSIONS.FONT.has(ext); break;
                case 'presentation':
                case 'powerpoint': isMatch = EXTENSIONS.OFFICE.PPT.has(ext); break;
                case 'excel': isMatch = EXTENSIONS.OFFICE.EXCEL.has(ext); break;
                case 'word': isMatch = EXTENSIONS.OFFICE.WORD.has(ext); break;
                case 'youtube': isMatch = ext === 'url' && item.medium === 'youtube'; break;
                case 'vimeo': isMatch = ext === 'url' && item.medium === 'vimeo'; break;
                // Add others as needed
            }
        }
        return rule.method === 'unequal' ? !isMatch : isMatch;
    }
};

// --- Main Export ---

/**
 * Check if an image matches a smart folder definition.
 * @param {Object} smartFolder - The smart folder definition (must contain conditions).
 * @param {Object} item - The item to check.
 * @param {Object} context - Context (folderMappings, etc).
 * @returns {boolean}
 */
export function checkSmartFilter(smartFolder, item, context = {}) {
    if (!smartFolder || !smartFolder.conditions) return false;

    // A Smart Folder has a list of Conditions.
    // Usually these top-level conditions are ANDed together? 
    // In Eagle, `conditions` is an array. 
    // BUT looking at `smart-filter-example`, it iterates `every` condition. So AND.

    return smartFolder.conditions.every(condition => {
        return checkCondition(condition, item, context);
    });
}

function checkCondition(condition, item, context) {
    if (!condition.rules || condition.rules.length === 0) return true;

    // Evaluate all rules in this condition
    const results = condition.rules.map(rule => {
        const matcher = Matchers[rule.property];
        if (matcher) {
            return matcher(rule, item, context);
        }
        return false; // Unknown rule type
    });

    // Combine rules based on condition.match (AND/OR)
    const mode = condition.match || 'OR'; // Default internal match is often OR in UI builder unless specified

    let isMatch = false;
    if (mode === 'AND') {
        isMatch = results.every(r => r);
    } else {
        isMatch = results.some(r => r);
    }

    // Handle Negation
    if (condition.boolean === 'FALSE') {
        return !isMatch;
    }
    return isMatch;
}
