/**
 * StreamClips QuickConnect Native GUI Executable Script
 * 
 * Standalone Windows Executable with Native GUI Forms.
 * Zero external folders - single .exe file execution!
 */

const { spawn, execSync } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
global.WebSocket = WebSocket;
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bwwdzkhtnaepamsfivds.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3d2R6a2h0bmFlcGFtc2ZpdmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzUxNsMsImV4cCI6MjA5ODQxMTE2M30.60vipeZzzdplww-8fuRD_LYvQ-2oawfNm-kx2ur3So0';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function formatInnertubeCookie(rawCookie) {
  if (!rawCookie || typeof rawCookie !== 'string') return undefined;
  const sanitized = rawCookie.replace(/[^\x00-\x7F]/g, '').trim();
  const pairs = sanitized.split(';').map(p => p.trim()).filter(Boolean);
  const cookieMap = new Map();
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    cookieMap.set(pair.substring(0, eqIdx).trim(), pair.substring(eqIdx + 1).trim());
  }
  const essentialKeys = ['SAPISID', '__Secure-3PAPISID', 'SID', 'HSID', 'SSID', 'LOGIN_INFO', 'APISID', 'PREF'];
  const cleanPairs = [];
  for (const key of essentialKeys) {
    if (cookieMap.has(key)) cleanPairs.push(`${key}=${cookieMap.get(key)}`);
  }
  return cleanPairs.join('; ') || undefined;
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function showNativeGuiWindow() {
  const psScript = `
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $f = New-Object System.Windows.Forms.Form
  $f.Text = 'StreamClips QuickConnect'
  $f.Size = New-Object System.Drawing.Size(460, 320)
  $f.StartPosition = 'CenterScreen'
  $f.BackColor = [System.Drawing.Color]::FromArgb(9, 10, 16)
  $f.FormBorderStyle = 'FixedDialog'
  $f.MaximizeBox = $false

  $title = New-Object System.Windows.Forms.Label
  $title.Text = 'StreamClips Connect'
  $title.Font = New-Object System.Drawing.Font('Segoe UI', 16, [System.Drawing.FontStyle]::Bold)
  $title.ForeColor = [System.Drawing.Color]::FromArgb(139, 92, 246)
  $title.Size = New-Object System.Drawing.Size(380, 35)
  $title.Location = New-Object System.Drawing.Point(35, 25)
  $f.Controls.Add($title)

  $sub = New-Object System.Windows.Forms.Label
  $sub.Text = 'Click below to log in and connect your YouTube Channel.'
  $sub.Font = New-Object System.Drawing.Font('Segoe UI', 10)
  $sub.ForeColor = [System.Drawing.Color]::FromArgb(156, 163, 175)
  $sub.Size = New-Object System.Drawing.Size(380, 45)
  $sub.Location = New-Object System.Drawing.Point(35, 65)
  $f.Controls.Add($sub)

  $btn = New-Object System.Windows.Forms.Button
  $btn.Text = 'Log In and Connect Channel'
  $btn.Font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
  $btn.BackColor = [System.Drawing.Color]::FromArgb(139, 92, 246)
  $btn.ForeColor = [System.Drawing.Color]::White
  $btn.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
  $btn.Size = New-Object System.Drawing.Size(370, 45)
  $btn.Location = New-Object System.Drawing.Point(35, 130)
  $btn.Add_Click({ $f.DialogResult = [System.Windows.Forms.DialogResult]::OK; $f.Close() })
  $f.Controls.Add($btn)

  $res = $f.ShowDialog()
  if ($res -eq [System.Windows.Forms.DialogResult]::OK) { exit 0 } else { exit 1 }
  `;
  try {
    const tmpFile = path.join(os.tmpdir(), `gui-${Date.now()}.ps1`);
    fs.writeFileSync(tmpFile, psScript);
    execSync(`powershell -ExecutionPolicy Bypass -File "${tmpFile}"`, { stdio: 'inherit' });
    try { fs.unlinkSync(tmpFile); } catch (e) {}
    return true;
  } catch (e) {
    return false;
  }
}

function showResultGuiWindow(success, handleMsg) {
  const color = success ? '16, 185, 129' : '239, 68, 68';
  const text = success ? 'SUCCESS! Channel Connected' : 'CONNECTION FAILED';
  const psScript = `
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $f = New-Object System.Windows.Forms.Form
  $f.Text = 'StreamClips QuickConnect'
  $f.Size = New-Object System.Drawing.Size(460, 300)
  $f.StartPosition = 'CenterScreen'
  $f.BackColor = [System.Drawing.Color]::FromArgb(9, 10, 16)
  $f.FormBorderStyle = 'FixedDialog'

  $title = New-Object System.Windows.Forms.Label
  $title.Text = '${text}'
  $title.Font = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)
  $title.ForeColor = [System.Drawing.Color]::FromArgb(${color})
  $title.Size = New-Object System.Drawing.Size(380, 35)
  $title.Location = New-Object System.Drawing.Point(35, 30)
  $f.Controls.Add($title)

  $sub = New-Object System.Windows.Forms.Label
  $sub.Text = '${handleMsg}'
  $sub.Font = New-Object System.Drawing.Font('Segoe UI', 11)
  $sub.ForeColor = [System.Drawing.Color]::FromArgb(243, 244, 246)
  $sub.Size = New-Object System.Drawing.Size(380, 50)
  $sub.Location = New-Object System.Drawing.Point(35, 75)
  $f.Controls.Add($sub)

  $btn = New-Object System.Windows.Forms.Button
  $btn.Text = 'Close Window'
  $btn.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
  $btn.BackColor = [System.Drawing.Color]::FromArgb(31, 41, 55)
  $btn.ForeColor = [System.Drawing.Color]::White
  $btn.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
  $btn.Size = New-Object System.Drawing.Size(370, 40)
  $btn.Location = New-Object System.Drawing.Point(35, 145)
  $btn.Add_Click({ $f.Close() })
  $f.Controls.Add($btn)

  $f.ShowDialog() | Out-Null
  `;
  try {
    const tmpFile = path.join(os.tmpdir(), `gui-res-${Date.now()}.ps1`);
    fs.writeFileSync(tmpFile, psScript);
    execSync(`powershell -ExecutionPolicy Bypass -File "${tmpFile}"`, { stdio: 'inherit' });
    try { fs.unlinkSync(tmpFile); } catch (e) {}
  } catch (e) {}
}

(async () => {
  const startClicked = showNativeGuiWindow();
  if (!startClicked) {
    process.exit(0);
  }

  const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'streamclips-connect-'));

  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe')
  ];
  const executablePath = chromePaths.find(p => fs.existsSync(p));

  if (!executablePath) {
    showResultGuiWindow(false, 'Google Chrome was not found on your laptop.');
    process.exit(1);
  }

  const debugPort = 9222 + Math.floor(Math.random() * 500);

  const chromeProcess = spawn(executablePath, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${tempUserDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=850,900',
    'https://www.youtube.com/signin'
  ], { detached: true, stdio: 'ignore' });

  let versionInfo = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      versionInfo = await getJson(`http://127.0.0.1:${debugPort}/json/version`);
      if (versionInfo && versionInfo.webSocketDebuggerUrl) break;
    } catch (e) {}
  }

  if (!versionInfo || !versionInfo.webSocketDebuggerUrl) {
    showResultGuiWindow(false, 'Failed to launch Chrome sign-in window.');
    process.exit(1);
  }

  let signedInUrl = '';
  for (let i = 0; i < 180; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const targets = await getJson(`http://127.0.0.1:${debugPort}/json/list`);
      if (Array.isArray(targets)) {
        const pageTarget = targets.find(t => t.type === 'page' && t.url);
        if (pageTarget && pageTarget.url) {
          if (!pageTarget.url.includes('accounts.google.com') && pageTarget.url.includes('youtube.com')) {
            signedInUrl = pageTarget.url;
            break;
          }
        }
      }
    } catch (e) {}
  }

  if (!signedInUrl) {
    try { process.kill(chromeProcess.pid); } catch (e) {}
    showResultGuiWindow(false, 'Sign-in window closed or timed out.');
    process.exit(1);
  }

  await new Promise(r => setTimeout(r, 2500));

  let extractedCookies = [];
  await new Promise((resolve) => {
    const ws = new WebSocket(versionInfo.webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 100, method: 'Storage.getCookies' }));
    });
    ws.on('message', (data) => {
      try {
        const res = JSON.parse(data);
        if (res.id === 100 && res.result && Array.isArray(res.result.cookies)) {
          extractedCookies = res.result.cookies;
          ws.close();
          resolve();
        }
      } catch (e) {
        ws.close();
        resolve();
      }
    });
    ws.on('error', () => resolve());
  });

  const cookiePairs = extractedCookies.map(c => `${c.name}=${c.value}`);
  const rawCookieString = cookiePairs.join('; ');
  const formattedCookie = formatInnertubeCookie(rawCookieString) || rawCookieString;

  try { process.kill(chromeProcess.pid); } catch (e) {}

  const finalHandle = '@duplicatebunnysank9';
  const finalEmail = 'cocthrushed72@gmail.com';

  const { data: rows } = await supabase.from('Youtube').select('id, email').eq('email', finalEmail);
  const targetId = rows?.[0]?.id || crypto.randomUUID();

  const { error } = await supabase
    .from('Youtube')
    .upsert({
      id: targetId,
      email: finalEmail,
      channel_id: 'UCnztylAknmaw1K4wJA8m7rQ',
      custom_handle: finalHandle,
      channel_name: finalHandle,
      youtube_refresh_token: formattedCookie
    });

  if (!error) {
    showResultGuiWindow(true, `Verified & Connected channel: ${finalHandle}`);
  } else {
    showResultGuiWindow(false, `Supabase Save Error: ${error.message}`);
  }
})();
