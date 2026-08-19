const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'FrontEnd');
const distDirs = [
  path.join(srcDir, 'dist'),
  path.join(__dirname, 'dist')
];

const filesToCopy = [
  'index.html',
  'dashboard.html',
  '3d-demo.js',
  'logo.svg',
  'option.css',
  'option.js',
  'pencil.png',
  'scissor.svg',
  'user.png',
  'heart.svg'
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

console.log('Starting build process...');

distDirs.forEach(dist => {
  ensureDir(dist);
  ensureDir(path.join(dist, '3D'));

  // Copy files
  filesToCopy.forEach(file => {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(dist, file);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, destFile);
      console.log(`Copied ${file} to ${path.basename(dist)}`);
    } else {
      console.warn(`Warning: source file ${srcFile} does not exist`);
    }
  });

  // Copy all files in the 3D assets directory dynamically
  const videoSrcDir = path.join(srcDir, '3D');
  const videoDestDir = path.join(dist, '3D');
  if (fs.existsSync(videoSrcDir)) {
    const videoFiles = fs.readdirSync(videoSrcDir);
    videoFiles.forEach(file => {
      const srcFile = path.join(videoSrcDir, file);
      const destFile = path.join(videoDestDir, file);
      if (fs.lstatSync(srcFile).isFile()) {
        fs.copyFileSync(srcFile, destFile);
        console.log(`Copied 3D/${file} to ${path.basename(dist)}/3D`);
      }
    });
  } else {
    console.warn(`Warning: 3D directory ${videoSrcDir} does not exist`);
  }
});

console.log('Build completed successfully.');
