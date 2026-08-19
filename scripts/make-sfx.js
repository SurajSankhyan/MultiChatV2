const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const zipBin = path.join(__dirname, '../connect-app-gui/node_modules/7zip-bin/win/x64/7za.exe');
const sourceDir = path.join(__dirname, '../connect-app-gui/dist/win-unpacked');
const appZip = path.join(__dirname, '../app.7z');
const sfxOutput = path.join(__dirname, '../StreamClips-Connect-GUI.exe');

console.log('Building Standalone Portable GUI Executable...');

if (fs.existsSync(appZip)) fs.unlinkSync(appZip);

console.log('1. Archiving win-unpacked dependencies into 7z payload...');
execSync(`"${zipBin}" a -t7z "${appZip}" "${sourceDir}\\*"`, { stdio: 'inherit' });

console.log('2. Configuring SFX Auto-Runner config...');
const configTxt = path.join(__dirname, '../config.txt');
const configContent = `;!@Install@!UTF-8!\nTitle="StreamClips Connect"\nRunProgram="StreamClips Connect.exe"\n;!@InstallEnd!\n`;
fs.writeFileSync(configTxt, configContent);

console.log('3. Downloading 7-Zip GUI SFX Module...');
const sfxModulePath = path.join(__dirname, '../7zS2.sfx');

(async () => {
  if (!fs.existsSync(sfxModulePath)) {
    const res = await fetch('https://raw.githubusercontent.com/chrisant99/7zip/master/C/Util/SfxSetup/7zS2.sfx');
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(sfxModulePath, buffer);
    }
  }

  if (fs.existsSync(sfxModulePath)) {
    console.log('4. Concatenating SFX Module + Config + Payload into StreamClips-Connect-GUI.exe...');
    const sfxBuf = fs.readFileSync(sfxModulePath);
    const cfgBuf = fs.readFileSync(configTxt);
    const appBuf = fs.readFileSync(appZip);
    const finalBuf = Buffer.concat([sfxBuf, cfgBuf, appBuf]);
    fs.writeFileSync(sfxOutput, finalBuf);
    console.log('🎉 PORTABLE GUI EXECUTABLE BUILT SUCCESSFULLY!');
    console.log('Output File:', sfxOutput);
    console.log('Size:', Math.round(finalBuf.length / 1024 / 1024), 'MB');
  } else {
    console.log('Using standard 7z sfx fallback...');
    // Create standard portable folder output
    const portableDir = path.join(__dirname, '../StreamClips-Connect-Portable');
    if (!fs.existsSync(portableDir)) fs.mkdirSync(portableDir, { recursive: true });
    execSync(`xcopy "${sourceDir}" "${portableDir}" /E /I /Y`, { stdio: 'inherit' });
    console.log('Created StreamClips-Connect-Portable directory with all required DLLs!');
  }
})();
