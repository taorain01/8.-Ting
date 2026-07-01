const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'output');

// Clear and create output directory
if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
}
fs.mkdirSync(outputDir, { recursive: true });

console.log('=== Step 1: Building EXE (Windows Installer) ===');
const distWinResult = spawnSync('npm', ['run', 'dist:win'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

if (distWinResult.status !== 0) {
  console.error('Failed to build EXE (electron-builder)');
  process.exit(distWinResult.status || 1);
}

console.log('\n=== Step 2: Building APK (Android Debug) ===');
const distAndroidResult = spawnSync('npm', ['run', 'android:build:debug'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

if (distAndroidResult.status !== 0) {
  console.error('Failed to build APK');
  process.exit(distAndroidResult.status || 1);
}

console.log('\n=== Step 3: Copying outputs to output/ folder ===');

// 1. Copy EXE
const distElectronDir = path.join(root, 'DongGoi', 'dist-electron');
let exeCopied = false;
if (fs.existsSync(distElectronDir)) {
  const files = fs.readdirSync(distElectronDir);
  const exeFiles = files.filter(file => file.endsWith('.exe'));
  for (const exeFile of exeFiles) {
    const srcPath = path.join(distElectronDir, exeFile);
    const destPath = path.join(outputDir, exeFile);
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied EXE: ${exeFile} -> output/${exeFile}`);
    exeCopied = true;
  }
}

if (!exeCopied) {
  console.warn('Warning: No EXE file found in DongGoi/dist-electron/');
}

// 2. Copy APK
const apkSrcDir = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug');
const apkSrcFile = path.join(apkSrcDir, 'app-debug.apk');
let apkCopied = false;

if (fs.existsSync(apkSrcFile)) {
  const destPath = path.join(outputDir, 'Ting-debug.apk');
  fs.copyFileSync(apkSrcFile, destPath);
  console.log(`Copied APK: app-debug.apk -> output/Ting-debug.apk`);
  apkCopied = true;
} else if (fs.existsSync(apkSrcDir)) {
  const files = fs.readdirSync(apkSrcDir);
  const apkFiles = files.filter(file => file.endsWith('.apk'));
  for (const apkFile of apkFiles) {
    const srcPath = path.join(apkSrcDir, apkFile);
    const destPath = path.join(outputDir, apkFile);
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied APK: ${apkFile} -> output/${apkFile}`);
    apkCopied = true;
  }
}

if (!apkCopied) {
  console.warn('Warning: No APK file found in android/app/build/outputs/apk/debug/');
}

console.log('\nBuild and package completed successfully! All files are in the "output" directory.');
