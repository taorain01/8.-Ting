const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const outputDir = path.join(root, 'DongGoi', 'dist-electron');
const installerName = `${pkg.name}-setup-${pkg.version}.exe`;
const installerPath = path.join(outputDir, installerName);

if (!fs.existsSync(installerPath)) {
  throw new Error(`Installer not found: ${installerPath}`);
}

for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
  if (entry.name === installerName) continue;
  if (entry.name === 'latest.yml') continue;
  fs.rmSync(path.join(outputDir, entry.name), { recursive: true, force: true });
}

console.log(`Kept installer and latest.yml: ${path.relative(root, installerPath)}`);
