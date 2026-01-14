import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Function to serve local files from a specific directory
const serveLocalMedia = (req, res, next) => {
  if (req.url.startsWith('/media/')) {
    const filePath = req.url.replace('/media/', '');
    // Decode URI component to handle spaces and special chars in filenames
    const decodedPath = decodeURIComponent(filePath);
    // Hardcoded absolute path to the library
    const libraryRoot = 'Z:\\My Library\\Pics\\エロもの.library\\images';

    // Construct full path
    // The URL structure: /media/{itemId}.info/{filename}
    // We can map this directly if the folder structure matches.
    // The user said: Z:\My Library\Pics\エロもの.library\images\{item_id}.info\
    // And I plan to request: /media/{item_id}.info/{filename}
    // So the "filePath" is {item_id}.info/{filename}

    const fullPath = path.join(libraryRoot, decodedPath);

    if (fs.existsSync(fullPath)) {
      // Set basic mime types if needed, or let browser guess/vite handle it
      // Basic implementation just piping stream
      const stream = fs.createReadStream(fullPath);
      stream.pipe(res);
      return;
    }
  }
  next();
}

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // Important for Electron build
  plugins: [
    react()
  ],
})
