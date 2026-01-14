var colorConvert = require('color-convert');
var DeltaE = require('delta-e');

// Constants (You may need to expand these lists based on your needs)
const VIDEO_TYPES = {
    mp4: true, mov: true, avi: true, wmv: true, webm: true, mkv: true, m4v: true, '3gp': true, ts: true
};
const AUDIO_TYPES = {
    mp3: true, wav: true, ogg: true, flac: true, aac: true, m4a: true
};
const FONT_TYPES = {
    ttf: true, otf: true, woff: true, ttc: true
};

// Helper Methods
var matchStringMethod = {};
matchStringMethod["equal"] = function (name, value) {
    return name === value;
};
matchStringMethod["startWith"] = function (name, value) {
    var isStartWith = new RegExp('^' + value, 'i').test(name);
    return isStartWith;
};
matchStringMethod["endWith"] = function (name, value) {
    var isEndWith = new RegExp(value + '$', 'i').test(name);
    return isEndWith;
};
matchStringMethod["uncontain"] = function (name, value) {
    return name.indexOf(value) === -1;
};
matchStringMethod["contain"] = function (name, value) {
    return name.indexOf(value) !== -1;
};
matchStringMethod["empty"] = function (name, value) {
    return name === "";
};
matchStringMethod["not-empty"] = function (name, value) {
    return name !== "";
};
matchStringMethod["regex"] = function (name, value) {
    try { return new RegExp(value, "g").test(name); }
    catch (err) { return false; }
};

function intersect(arr1, arr2) {
    var temp = {};
    var result = [];
    for (let i = 0; i < arr1.length; i++) { temp[arr1[i]] = true; }
    for (let j = 0; j < arr2.length; j++) {
        if (temp[arr2[j]] === true) {
            result.push(arr2[j]);
        }
    }
    return result;
}

function hexToRGB(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
}

function colorSimilarityDistance(color1, color2) {
    var c1 = colorConvert.rgb.lab(color1[0], color1[1], color1[2]);
    var c2 = colorConvert.rgb.lab(color2[0], color2[1], color2[2]);
    var l1 = { L: c1[0], A: c1[1], B: c1[2] };
    var l2 = { L: c2[0], A: c2[1], B: c2[2] };
    var d76 = DeltaE.getDeltaE76(l1, l2);
    var d2000 = DeltaE.getDeltaE00(l1, l2);
    return {
        d76: d76,
        d2000: d2000,
    };
};

/* --- Rule Matchers --- */

function isMatchNameRule(rule, image) {
    var method = rule.method;
    var name = image.name && image.name.toLowerCase();
    var value = rule.value && rule.value.toLowerCase();

    if (!name) name = "";
    if (method !== 'empty' && method !== 'not-empty' && value == '') return false;
    if (matchStringMethod[method]) {
        return matchStringMethod[method](name, value);
    }
    return false;
}

function isMatchFolderNameRule(rule, item, folderMappings) {
    const method = rule.method;
    const value = rule.value && rule.value.toLowerCase();

    if (!item?.folders?.length) return false;

    for (let i = 0; i < item.folders.length; i++) {
        const folderId = item.folders[i];
        const folder = folderMappings ? folderMappings[folderId] : null;
        let name = folder?.name;
        if (!name) name = "";
        name = name.toLowerCase();
        if (method !== 'empty' && method !== 'not-empty' && value == '') return false;
        if (matchStringMethod[method]) {
            let isMatch = matchStringMethod[method](name, value);
            if (isMatch) return true;
        }
    }
    return false;
}

function isMatchUrlRule(rule, image) {
    var method = rule.method;
    var url = image.url && image.url.toLowerCase();
    var value = rule.value && rule.value.toLowerCase();

    if (!url) url = "";
    if (method !== 'empty' && method !== 'not-empty' && value == '') return false;

    if (matchStringMethod[method]) {
        return matchStringMethod[method](url, value);
    }
    return false;
}

function isMatchAnnotationRule(rule, image) {
    var method = rule.method;
    var annotation = image.annotation && image.annotation.toLowerCase();
    var value = rule.value && rule.value.toLowerCase();

    if (!annotation) annotation = "";
    if (method !== 'empty' && method !== 'not-empty' && value == '') return false;

    if (matchStringMethod[method]) {
        return matchStringMethod[method](annotation, value);
    }
    return false;
}

function isMatchWidthRule(rule, image) {
    try {
        var method = rule.method;
        var width = image.width;
        var value1 = rule.value[0];
        var value2 = rule.value[1];

        if (!width && width > 0) return false;

        switch (method) {
            case '=': return width === value1;
            case '>=': return width >= value1;
            case '<=': return width <= value1;
            case '>': return width > value1;
            case '<': return width < value1;
            case 'between': return value1 <= width && width <= value2;
        }
        return false;
    } catch (err) { return false; }
}

function isMatchHeightRule(rule, image) {
    try {
        var method = rule.method;
        var height = image.height;
        var value1 = rule.value[0];
        var value2 = rule.value[1];

        if (!height && height > 0) return false;

        switch (method) {
            case '=': return height === value1;
            case '>=': return height >= value1;
            case '<=': return height <= value1;
            case '>': return height > value1;
            case '<': return height < value1;
            case 'between': return value1 <= height && height <= value2;
        }
        return false;
    } catch (err) { return false; }
}

function isMatchFileSizeRule(rule, image) {
    try {
        var method = rule.method;
        var size = image.size;
        var value1 = rule.value[0];
        var value2 = rule.value[1];
        var unit = rule.unit;

        if (unit === 'kb') {
            size = size / 1024;
        } else {
            size = size / 1024 / 1024;
        }

        if (!size && size > 0) return false;

        switch (method) {
            case '=': return size === value1;
            case '>=': return size >= value1;
            case '<=': return size <= value1;
            case '>': return size > value1;
            case '<': return size < value1;
            case 'between': return value1 <= size && size <= value2;
        }
        return false;
    } catch (err) { return false; }
}

function isMatchDurationRule(rule, image) {
    try {
        var method = rule.method;
        var duration = image.duration;

        if (!duration) return false;

        var value1 = rule.value[0];
        var value2 = rule.value[1];
        var unit = rule.unit;

        if (unit === 'h') {
            duration = duration / 60 / 60;
        } else if (unit === 'm') {
            duration = duration / 60;
        }

        if (!duration && duration > 0) return false;

        switch (method) {
            case '=': return duration === value1;
            case '>=': return duration >= value1;
            case '<=': return duration <= value1;
            case '>': return duration > value1;
            case '<': return duration < value1;
            case 'between': return value1 <= duration && duration <= value2;
        }
        return false;
    } catch (err) { return false; }
}

function isMatchBPMRule(rule, image) {
    try {
        var method = rule.method;
        var bpm = image.bpm;

        if (!bpm) return false;

        var value1 = rule.value[0];
        var value2 = rule.value[1];

        switch (method) {
            case '=': return bpm === value1;
            case '>=': return bpm >= value1;
            case '<=': return bpm <= value1;
            case '>': return bpm > value1;
            case '<': return bpm < value1;
            case 'between': return value1 <= bpm && bpm <= value2;
        }
        return false;
    } catch (err) { return false; }
}

function isMatchTimeRule(rule, image) {
    try {
        var method = rule.method;
        var modificationTime = image.modificationTime; // 'createTime' maps to modificationTime in some contexts, or use image.btime/creationTime if available
        var value1 = rule.value[0];
        var value2 = rule.value[1];

        if (!modificationTime) return false;
        var DAY = 1000 * 60 * 60 * 24;
        switch (method) {
            case 'on': return new Date(modificationTime).toDateString() == new Date(value1).toDateString();
            case 'before': return modificationTime <= value1 + DAY;
            case 'after': return modificationTime >= value1;
            case 'between': return value1 <= modificationTime && modificationTime <= value2 + DAY;
            case 'within':
                var days = value1;
                return modificationTime + days * DAY >= Date.now();
        }
        return false;
    } catch (err) { return false; }
}

function isMatchMTimeRule(rule, image) {
    try {
        var method = rule.method;
        var mtime = image.mtime || image.modificationTime;
        var value1 = rule.value[0];
        var value2 = rule.value[1];

        if (!mtime) return false;
        var DAY = 1000 * 60 * 60 * 24;
        switch (method) {
            case 'on': return new Date(mtime).toDateString() == new Date(value1).toDateString();
            case 'before': return mtime <= value1 + DAY;
            case 'after': return mtime >= value1;
            case 'between': return value1 <= mtime && mtime <= value2 + DAY;
            case 'within':
                var days = value1;
                return mtime + days * DAY >= Date.now();
        }
        return false;
    } catch (err) { return false; }
}

function isMatchBTimeRule(rule, image) {
    try {
        var method = rule.method;
        var btime = image.btime || image.modificationTime;
        var value1 = rule.value[0];
        var value2 = rule.value[1];

        if (!btime) return false;
        var DAY = 1000 * 60 * 60 * 24;
        switch (method) {
            case 'on': return new Date(btime).toDateString() == new Date(value1).toDateString();
            case 'before': return btime <= value1 + DAY;
            case 'after': return btime >= value1;
            case 'between': return value1 <= btime && btime <= value2 + DAY;
            case 'within':
                var days = value1;
                return btime + days * DAY >= Date.now();
        }
        return false;
    } catch (err) { return false; }
}

function isMatchCommentsRule(rule, image) {
    if (!image) { return false; };

    var method = rule.method;
    var comments = image.comments;
    var commentString = "";
    var value = rule.value;

    if (method === 'empty') {
        if (!image.comments || image.comments.length === 0) return true;
    } else if (method === 'not-empty') {
        if (image.comments && image.comments.length > 0) return true;
    } else {
        if (!image || !image.comments) { return false; };
        for (var i = 0; i < comments.length; i++) {
            commentString += comments[i].annotation;
        }
        switch (method) {
            case 'equal': return commentString === value;
            case 'startWith': return new RegExp('^' + value, 'i').test(commentString);
            case 'endWith': return new RegExp(value + '$', 'i').test(commentString);
            case 'uncontain': return commentString.indexOf(value) === -1;
            case 'contain': return commentString.indexOf(value) !== -1;
            case 'regex':
                try { return new RegExp(value, "g").test(commentString); }
                catch (err) { return false; }
        }
    }
    return false;
}

function isMatchTagsRule(rule, image) {
    if (!image) { return false; };
    if (!image.tags) return false;

    var method = rule.method;
    var tags = image.tags;
    var value = rule.value;

    if (method === 'empty') {
        if (!image.tags || image.tags.length === 0) return true;
    } else if (method === 'not-empty') {
        if (image.tags && image.tags.length > 0) return true;
    } else {
        var isIntersect = intersect(tags, value).length === value.length && value.length != 0;
        var isUnion = false;

        for (var i = 0; i < tags.length; i++) {
            if (value.indexOf(tags[i]) !== -1) {
                isUnion = true;
                break;
            }
        }

        switch (method) {
            case 'intersection': return isIntersect;
            case 'equal': return isIntersect && tags.length === value.length;
            case 'union': return isUnion;
            case 'identity': return !isUnion;
        }
    }
    return false;
}

function isMatchFoldersRule(rule, image) {
    if (!image || !image.folders) { return false; };

    var method = rule.method;
    var folders = image.folders;
    var value = rule.value;

    if (method === 'empty') {
        if (!folders || folders.length === 0) return true;
    } else if (method === 'not-empty') {
        if (folders && folders.length > 0) return true;
    } else {
        var isIntersect = intersect(folders, value).length === value.length;
        var isUnion = false;

        for (var i = 0; i < folders.length; i++) {
            if (value.indexOf(folders[i]) !== -1) {
                isUnion = true;
                break;
            }
        }

        switch (method) {
            case 'intersection': return isIntersect;
            case 'equal': return isIntersect && folders.length === value.length;
            case 'union': return isUnion;
            case 'identity': return !isUnion;
        }
    }
    return false;
}

function isMatchTypeRule(rule, image) {
    var ext = image.ext;
    var result = false;

    if (ext === rule.value) {
        return (rule.method === "equal");
    }

    switch (rule.value) {
        case "videos":
        case "video": result = VIDEO_TYPES[ext]; break;
        case "audio": result = AUDIO_TYPES[ext]; break;
        case "powerpoint": if (ext == 'ppt' || ext == 'pptx' || ext == 'potx') result = true; break;
        case "presentation": if (ext == 'ppt' || ext == 'key' || ext == 'pptx') result = true; break;
        case "excel": if (ext == 'xls' || ext == 'xlsx') result = true; break;
        case "word": if (ext == 'doc' || ext == 'docx') result = true; break;
        case "font": result = FONT_TYPES[ext]; break;
        case "url": if (ext == 'url' && !image.medium) result = true; break;
        case "youtube": if (ext == 'url' && image.medium == 'youtube') result = true; break;
        case "vimeo": if (ext == 'url' && image.medium == 'vimeo') result = true; break;
        case "bilibili": if (ext == 'url' && image.medium == 'bilibili') result = true; break;
        default: result = (ext === rule.value); break;
    }

    switch (rule.method) {
        case 'equal': return result;
        case 'unequal': return !result;
    }
    return false;
}

function isMatchRatingRule(rule, image) {
    try {
        var method = rule.method;
        var star = image.star || undefined;
        var value = parseInt(rule.value) || undefined;

        switch (method) {
            case 'contain':
                if (rule.value.indexOf('none') === -1) {
                    return rule.value.indexOf(star) !== -1;
                } else {
                    if (rule.value.indexOf(star) !== -1) return true;
                    if (rule.value.indexOf("none") !== -1) return true;
                    return false;
                }
            case 'equal':
                if (value !== 'none') return star === value;
                else return star === undefined;
            case 'unequal':
                if (value !== 'none') return star !== value;
                else return star !== undefined;
        }
        return false;
    } catch (err) { return false; }
}

function isMatchShapeRule(rule, image) {
    var method = rule.method;
    var value = rule.value;
    var width = image.width;
    var height = image.height;
    var isEqual = false;

    if (value !== "custom") {
        let shape;
        if (image.width > image.height) {
            if (image.width > image.height && image.width / image.height >= 2.5) shape = "panoramic-landscape";
            else shape = "landscape";
        } else if (image.width < image.height) {
            if (image.width < image.height && image.height / image.width >= 2.5) shape = "panoramic-portrait";
            else shape = "portrait";
        } else if (image.width === image.height) {
            shape = "square";
        }
        isEqual = (shape === value);
    } else {
        if (!rule.width || !rule.height) return false;
        isEqual = (rule.width / rule.height === width / height);
    }

    if (method === 'equal') return isEqual;
    else return !isEqual;
}

var cacheColorMappings = {};
function isMatchColorRule(rule, image) {
    if (!image || !image.palettes) return false;

    if (!cacheColorMappings[rule.value]) {
        cacheColorMappings[rule.value] = hexToRGB(rule.value);
    }

    var method = rule.method;
    var similarColor = cacheColorMappings[rule.value] || hexToRGB(rule.value);
    var palettes = image.palettes;
    var similarity = 20;

    if (method === 'grayscale') {
        if (palettes) {
            for (var i = palettes.length - 1; i >= 0; i--) {
                let palette = palettes[i];
                if (palette.ratio >= 0.02) {
                    var r = palette.color[0];
                    var g = palette.color[1];
                    var b = palette.color[2];
                    if (Math.abs(r - g) >= 8 || Math.abs(r - b) >= 8 || Math.abs(g - b) >= 8) {
                        return false;
                    }
                }
            }
            return true;
        }
        return false;
    }

    if (method === 'accuracy') {
        similarity = 10;
    }

    if (!similarColor) return true;
    if (!image.palettes || image.palettes.length < 0) return false;
    if (!image.palettes[0]) return false;

    var ratio0 = image.palettes[0].ratio;
    var r0 = image.palettes[0].color[0];
    var g0 = image.palettes[0].color[1];
    var b0 = image.palettes[0].color[2];
    var rt = similarColor[0];
    var gt = similarColor[1];
    var bt = similarColor[2];

    if (ratio0 < 33) return false;

    if (r0 - rt > 96 || g0 - gt > 96 || b0 - bt > 96 || r0 - rt < -96 || g0 - gt < -96 || b0 - bt < -96) {
        return false;
    }

    if (image.palettes[0] && image.palettes[1]) {
        if (image.palettes[0].color[0] == similarColor[0] && image.palettes[0].color[1] == similarColor[1] && image.palettes[0].color[2] == similarColor[2] ||
            image.palettes[1].color[0] == similarColor[0] && image.palettes[1].color[1] == similarColor[1] && image.palettes[1].color[2] == similarColor[2]) {
            return true;
        }
    }

    if (image.palettes[0]) {
        if (image.palettes[0].ratio > 33) {
            let d = colorSimilarityDistance(similarColor, image.palettes[0].color);
            if (d.d2000 < similarity && d.d76 < similarity + 50) {
                return true;
            }
        }
    }

    if (image.palettes[1]) {
        if (image.palettes[1].ratio > 33) {
            let d2 = colorSimilarityDistance(similarColor, image.palettes[1].color);
            if (d2.d2000 < similarity && d2.d76 < similarity + 50) {
                return true;
            }
        }
    }
    return false;
}

function isMatchCameraRule(rule, image) {
    var method = rule.method;
    if (!image.rawMetas || !image.rawMetas.camera) return false;
    var camera = image.rawMetas.camera && image.rawMetas.camera.toLowerCase();
    var value = rule.value && rule.value.toLowerCase();

    if (!camera) camera = "";
    if (method !== 'empty' && method !== 'not-empty' && value == '') return false;

    if (matchStringMethod[method]) {
        return matchStringMethod[method](camera, value);
    }
    return false;
}

function isMatchISORule(rule, image) {
    var method = rule.method;
    if (!image.rawMetas || !image.rawMetas.isoSpeed) return false;
    var iso = parseInt(image.rawMetas.isoSpeed);
    var value1 = parseInt(rule.value[0]);
    var value2 = parseInt(rule.value[1]);

    if (!iso && iso > 0) return false;

    switch (method) {
        case '=': return iso === value1;
        case '>=': return iso >= value1;
        case '<=': return iso <= value1;
        case '>': return iso > value1;
        case '<': return iso < value1;
        case 'between': return value1 <= iso && iso <= value2;
    }
    return false;
}

function isMatchApertureRule(rule, image) {
    try {
        var method = rule.method;
        if (!image.rawMetas || !image.rawMetas.aperture) return false;
        var aperture = parseFloat(image.rawMetas.aperture.match(/[+-]?\d+(\.\d+)?/g)[0]);
        var value1 = parseFloat(rule.value[0]);
        var value2 = parseFloat(rule.value[1]);

        if (!aperture && aperture > 0) return false;

        switch (method) {
            case '=': return aperture === value1;
            case '>=': return aperture >= value1;
            case '<=': return aperture <= value1;
            case '>': return aperture > value1;
            case '<': return aperture < value1;
            case 'between': return value1 <= aperture && aperture <= value2;
        }
        return false;
    } catch (err) { return false; }
}

function isMatchFocalLengthRule(rule, image) {
    try {
        var method = rule.method;
        if (!image.rawMetas || !image.rawMetas.focalLength) return false;
        var focalLength = parseFloat(image.rawMetas.focalLength.match(/[+-]?\d+(\.\d+)?/g)[0]);
        var value1 = parseFloat(rule.value[0]);
        var value2 = parseFloat(rule.value[1]);

        if (!focalLength && focalLength > 0) return false;

        switch (method) {
            case '=': return focalLength === value1;
            case '>=': return focalLength >= value1;
            case '<=': return focalLength <= value1;
            case '>': return focalLength > value1;
            case '<': return focalLength < value1;
            case 'between': return value1 <= focalLength && focalLength <= value2;
        }
        return false;
    } catch (err) { return false; }
}

function isMatchShutterRule(rule, image) {
    try {
        var method = rule.method;
        if (!image.rawMetas || !image.rawMetas.shutter) return false;
        var shutter = parseFloat(image.rawMetas.shutter.match(/[+-]?\d+(\.\d+)?/g)[1]);
        var value1 = parseFloat(rule.value[0]);
        var value2 = parseFloat(rule.value[1]);

        if (!shutter && shutter > 0) return false;

        switch (method) {
            case '=': return shutter === value1;
            case '>=': return shutter >= value1;
            case '<=': return shutter <= value1;
            case '>': return shutter > value1;
            case '<': return shutter < value1;
            case 'between': return value1 <= shutter && shutter <= value2;
        }
        return false;
    } catch (err) { return false; }
}

function isMatchTimestampRule(rule, image) {
    var method = rule.method;
    if (!image.rawMetas || !image.rawMetas.timestamp) return false;
    var timestamp = parseInt(image.rawMetas.timestamp);
    var value1 = parseInt(rule.value[0]);
    var value2 = parseInt(rule.value[1]);

    if (!timestamp) return false;
    var DAY = 1000 * 60 * 60 * 24;
    switch (method) {
        case 'on': return new Date(timestamp).toDateString() == new Date(value1).toDateString();
        case 'before': return timestamp <= value1 + DAY;
        case 'after': return timestamp >= value1;
        case 'between': return value1 <= timestamp && timestamp <= value2 + DAY;
        case 'within':
            var days = value1;
            return timestamp + days * 1000 * 24 * 60 * 60 >= Date.now();
    }
    return false;
}

function isMatchFontActivatedRule(rule, image, installedFonts) {
    if (!image || !image.fontMetas) return false;

    try {
        var method = rule.method;
        var key = Object.keys(image.fontMetas.postScriptName)[0];
        var postScriptName = image.fontMetas.postScriptName && image.fontMetas.postScriptName[key];
        if (!postScriptName) return false;

        var isInstalled = installedFonts ? installedFonts[`${postScriptName}_.${image.ext}`] : false;

        switch (method) {
            case 'activate': return isInstalled;
            case 'deactivate': return !isInstalled;
        }
    } catch (err) { return false; }
    return false;
}

// Main logic for Smart Filter Parsing
function checkSmartFilter(smartFolder, image, context) {
    if (!smartFolder || !smartFolder.conditions) return false;

    // Default assumption: AND between conditions (check all conditions)
    // You might want to adjust this based on your specific 'match' logic for conditions if different.
    return smartFolder.conditions.every(function (condition) {
        return checkCondition(condition, image, context);
    });
}

function checkCondition(condition, image, context) {
    if (!condition.rules || condition.rules.length === 0) return true;

    var context = context || {};

    var results = condition.rules.map(function (rule) {
        switch (rule.property) {
            case 'name': return isMatchNameRule(rule, image);
            case 'folderName': return isMatchFolderNameRule(rule, image, context.folderMappings); // Assuming folderName maps here
            case 'url': return isMatchUrlRule(rule, image);
            case 'annotation': return isMatchAnnotationRule(rule, image);
            case 'width': return isMatchWidthRule(rule, image);
            case 'height': return isMatchHeightRule(rule, image);
            case 'fileSize': return isMatchFileSizeRule(rule, image);
            case 'duration': return isMatchDurationRule(rule, image);
            case 'bpm': return isMatchBPMRule(rule, image);
            case 'createTime': return isMatchTimeRule(rule, image);
            case 'mtime': return isMatchMTimeRule(rule, image);
            case 'btime': return isMatchBTimeRule(rule, image);
            case 'comments': return isMatchCommentsRule(rule, image);
            case 'tags': return isMatchTagsRule(rule, image);
            case 'folders': return isMatchFoldersRule(rule, image);
            case 'type': return isMatchTypeRule(rule, image);
            case 'rating': return isMatchRatingRule(rule, image);
            case 'shape': return isMatchShapeRule(rule, image);
            case 'color': return isMatchColorRule(rule, image);
            case 'camera': return isMatchCameraRule(rule, image);
            case 'iso': return isMatchISORule(rule, image);
            case 'aperture': return isMatchApertureRule(rule, image);
            case 'focalLength': return isMatchFocalLengthRule(rule, image);
            case 'shutter': return isMatchShutterRule(rule, image);
            case 'timestamp': return isMatchTimestampRule(rule, image);
            case 'fontActivated': return isMatchFontActivatedRule(rule, image, context.installedFonts);
            default: return false;
        }
    });

    var isMatch = false;
    // Default OR for rules within a condition, unless specified (check if condition.match === 'AND')
    // In many UI implementations shown, match='OR' is common for inner rules.
    if (condition.match === 'OR') {
        isMatch = results.some(function (r) { return r; });
    } else if (condition.match === 'AND') {
        isMatch = results.every(function (r) { return r; });
    } else {
        // Default fallback
        isMatch = results.some(function (r) { return r; });
    }

    if (condition.boolean === 'FALSE') {
        return !isMatch;
    }
    return isMatch;
}

module.exports = {
    checkSmartFilter: checkSmartFilter,
    // Export matchers if needed individually
};
