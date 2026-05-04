const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function findFirstFile(dir, fileName) {
  if (!fs.existsSync(dir)) return null;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.name.toLowerCase() === fileName.toLowerCase()) return fullPath;
    }
  }
  return null;
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const root = path.resolve(__dirname, '..');
  const iconPath = path.join(root, 'DongGoi', 'build', 'icon.ico');
  const cachedRcedit = findFirstFile(path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'winCodeSign'), 'rcedit-x64.exe');
  const rceditPath = cachedRcedit || path.join(root, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe');
  const version = context.packager?.appInfo?.version || '1.0.0';
  const productName = 'Ting!';
  const executableName = 'Ting.exe';
  const exePath = [
    path.join(context.appOutDir, executableName),
    path.join(context.appOutDir, 'Ting!.exe'),
  ].find(candidate => fs.existsSync(candidate));

  if (!exePath) {
    throw new Error(`Cannot find Ting executable in ${context.appOutDir}`);
  }
  if (!fs.existsSync(iconPath)) {
    throw new Error(`Cannot find app icon at ${iconPath}`);
  }
  if (!fs.existsSync(rceditPath)) {
    throw new Error(`Cannot find rcedit at ${rceditPath}`);
  }

  execFileSync(rceditPath, [
    exePath,
    '--set-icon', iconPath,
    '--set-version-string', 'FileDescription', productName,
    '--set-version-string', 'ProductName', productName,
    '--set-version-string', 'InternalName', 'Ting',
    '--set-version-string', 'OriginalFilename', executableName,
    '--set-version-string', 'CompanyName', productName,
    '--set-version-string', 'LegalCopyright', `Copyright (C) ${new Date().getFullYear()} ${productName}`,
    '--set-file-version', version,
    '--set-product-version', version,
  ], { stdio: 'inherit' });

  console.log(`Applied Ting icon and metadata to ${exePath}`);
};
