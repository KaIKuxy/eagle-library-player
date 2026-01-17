# Eagle Library Player

A custom, high-performance media player designed specifically for browsing and playing content from your local [Eagle](https://en.eagle.cool/) libraries. Built with Electron, React, and Vite.

## Features

### 🎮 Media Playback
- **Universal Support**: Plays both videos (`mp4`, `webm`, etc.) and images (slideshow mode).
- **Smooth Navigation**: Previous/Next controls, seeking, and volume management.
- **Smart Shuffle**: Weighted shuffling algorithm that prioritizes the current item.

### 🧠 Smart Library Integration
- **Direct Eagle Access**: Reads directly from your Eagle library structure.
- **Smart Folders**: Supports fetching and filtering items based on your Eagle Smart Folder definitions.
- **Tag Integration**: "Like" / Favorite items directly from the player (syncs back to Eagle).

### ⚡ Advanced Playback Control
- **Skip Viewed Mode**: Automatically skips media you've already seen in the current session/history.
- **Viewed History**: Visual checkmarks on visited items and persistent history tracking.
- **Auto-Unload**: Automatically unloads the playlist when all items have been viewed (in Skip Viewed mode).
- **Clear History**: Easy option to wipe your viewed status and start fresh.

### 🛠 UI / UX
- **Always on Top**: "Pin" mode to keep the player floating over other windows.
- **Minimalist Interface**: Controls fade out for an immersive viewing experience.
- **Progress Persistence**: Remembers where you left off.

## Getting Started

### Prerequisites
- Node.js (v16+)
- An Eagle Library

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/KaIKuxy/eagle-library-player.git
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development build:
   ```bash
   npm run electron:dev
   ```

## Technology Stack
- **Electron**: Desktop wrapper.
- **React**: UI Library.
- **Vite**: Build tool and bundler.
- **Zustand**: State management.
- **Lucide React**: Iconography.
