const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function topLevelFunctionNames(source) {
  const names = new Map();
  for (const match of source.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
    names.set(match[1], (names.get(match[1]) || 0) + 1);
  }
  return names;
}

function runtimeJavaScriptFiles(relativeDir) {
  const absoluteDir = path.join(ROOT, relativeDir);
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'vendor') return [];
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) return runtimeJavaScriptFiles(relativePath);
    return /\.(?:js|cjs)$/.test(entry.name) ? [relativePath.replace(/\\/g, '/')] : [];
  });
}

describe('Runtime stability guards', () => {
  it('does not keep duplicate top-level function declarations in active runtimes', () => {
    const files = [
      ...runtimeJavaScriptFiles('js'),
      ...runtimeJavaScriptFiles('mobile/js'),
      ...runtimeJavaScriptFiles('DongGoi/electron'),
    ];
    const duplicates = [];
    files.forEach(file => {
      for (const [name, count] of topLevelFunctionNames(read(file))) {
        if (count > 1) duplicates.push(`${file}:${name} (${count})`);
      }
    });
    expect(duplicates).toEqual([]);
  });

  it('escapes PC account detail names and renders avatars through DOM properties', () => {
    expect(read('js/desktop-ui.js')).toContain('${escapeHtml(acc.name || \'\')}');
    expect(read('js/desktop-app.js')).toContain('image.src = String(u.avatar)');
    expect(read('mobile/js/app.js')).toContain('image.src = String(user.avatar)');
    expect(read('js/app.js')).toContain('image.src = String(user.avatar)');
    expect(read('js/desktop-app.js')).toContain("escapeHtml(r.username || '—')");
    expect(read('mobile/js/app.js')).toContain("escapeHtml(r.password || '—')");
  });

  it('neutralizes an HTML error-handler payload before desktop detail rendering', () => {
    const source = read('js/desktop-ui.js');
    const start = source.indexOf('function escapeHtml');
    const end = source.indexOf('\n}', start) + 2;
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const sandbox = { escaped: '' };
    vm.runInNewContext(
      `${source.slice(start, end)}\nescaped = escapeHtml('<img src=x onerror=globalThis.pwned=1>');`,
      sandbox
    );

    expect(sandbox.escaped).not.toContain('<img');
    expect(sandbox.escaped).toContain('&lt;img');
    expect(sandbox.pwned).toBeUndefined();
  });

  it('uses local date formatting for business dates', () => {
    const utils = read('js/utils.js');
    expect(utils).toContain('function formatLocalDateInput');
    expect(utils).toContain('return formatLocalDateInput(new Date());');
    expect(utils).not.toMatch(/function todayStr\(\)[\s\S]{0,120}toISOString\(\)/);
  });

  it('keeps dialog back APIs, Android backup exclusions and CSP baseline', () => {
    expect(read('js/dialogs.js')).toContain('function handleBack()');
    expect(read('mobile/js/dialogs.js')).toContain('function isOpen()');
    expect(read('mobile/js/app.js')).toContain('window.TingFeedback?.handleBack?.()');
    expect(read('android/app/src/main/AndroidManifest.xml')).toContain('android:allowBackup="false"');
    expect(read('android/app/src/main/AndroidManifest.xml')).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');
    expect(read('android/app/src/main/res/xml/data_extraction_rules.xml')).toContain('<device-transfer>');
    expect(read('DongGoi/electron/main.cjs')).toContain("'Content-Security-Policy': CONTENT_SECURITY_POLICY");
    expect(read('index.html')).toContain("object-src 'none'");
    expect(read('index.html')).toContain("script-src 'self' https://www.gstatic.com; script-src-attr 'unsafe-inline'");
    expect(read('index.html')).not.toMatch(/<script>\s*[\s\S]*?<\/script>/i);
    expect(read('index.html')).toContain('js/electron-titlebar.js');
  });

  it('exposes preview/merge APIs for complete backup restore', () => {
    const source = read('js/backup.js');
    expect(source).toContain('parseBackupForRestore');
    expect(source).toContain('applyBackupRestore');
    expect(source).toContain('backup-restore-trash');
    expect(source).toContain('backup-restore-categories');
  });

  it('keeps mobile zoom available and adds keyboard activation support', () => {
    expect(read('mobile/index.html')).not.toContain('user-scalable=no');
    expect(read('js/utils.js')).toContain('initAccessibleClickTargets');
    expect(read('mobile/css/components.css')).toContain('[role="button"][tabindex="0"]:focus-visible');
  });
});
