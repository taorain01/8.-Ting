const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const www = path.join(root, 'www');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(source, target) {
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
}

function copyDir(source, target) {
  if (!fs.existsSync(source)) return;
  ensureDir(target);
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) copyDir(sourcePath, targetPath);
    else copyFile(sourcePath, targetPath);
  }
}

fs.rmSync(www, { recursive: true, force: true });
ensureDir(www);

copyFile(path.join(root, 'mobile', 'index.html'), path.join(www, 'index.html'));
copyFile(path.join(root, 'firebase-config.js'), path.join(www, 'firebase-config.js'));
copyDir(path.join(root, 'mobile', 'css'), path.join(www, 'css'));
copyDir(path.join(root, 'mobile', 'js'), path.join(www, 'js'));
copyDir(path.join(root, 'assets'), path.join(www, 'assets'));
copyDir(path.join(root, 'js', 'shared'), path.join(www, 'js', 'shared'));
copyDir(path.join(root, 'js', 'vendor'), path.join(www, 'js', 'vendor'));

const sharedScripts = [
  'utils.js',
  'parser.js',
  'notification.js',
  'platform-icons.js',
  'platform-tags.js',
  'crypto.js',
  'db.js',
  'expenses.js',
  'auth.js',
  'groups.js',
  'mobile-updater.js',
  'background-check.js',
];

for (const file of sharedScripts) {
  copyFile(path.join(root, 'js', file), path.join(www, 'js', file));
}

console.log('Prepared Android web bundle at www/');
