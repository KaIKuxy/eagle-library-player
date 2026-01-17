const { app } = require('electron');

const isDebug = process.env.BUILD_TYPE === 'debug';

/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const config = {
    appId: isDebug ? "com.ppmiya.eaglelibraryplayer.debug" : "com.ppmiya.eaglelibraryplayer",
    productName: isDebug ? "Eagle Library Player (Debug)" : "Eagle Library Player",
    files: [
        "dist/**/*",
        "electron/**/*",
        "package.json"
    ],
    directories: {
        output: "dist"
    },
    win: {
        target: "nsis",
        artifactName: isDebug ? "Eagle-Library-Player-Debug.exe" : "Eagle-Library-Player-Release.exe"
    },
    // Inject a flag into the packaged package.json so main process knows it's a debug build
    extraMetadata: {
        debugBuild: isDebug
    }
};

module.exports = config;
