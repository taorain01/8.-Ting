const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const dialogs = require('../../js/dialogs.js');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('Ting dialog system', () => {
  it('normalizes variants and destructive defaults', () => {
    const danger = dialogs.normalizeDialogOptions({ variant: 'danger', message: 'Delete' });
    expect(danger.variant).toBe('danger');
    expect(danger.title).toBe('Xác nhận thao tác');
    expect(danger.confirmLabel).toBe('Xác nhận');
    expect(danger.showCancel).toBe(true);
  });

  it('keeps typed confirmation and secure prompt configuration', () => {
    const options = dialogs.normalizeDialogOptions({
      confirmationText: 'XÓA',
      dismissible: false,
      input: { type: 'password', autocomplete: 'current-password', maxLength: 256 },
    });
    expect(options.confirmationText).toBe('XÓA');
    expect(options.dismissible).toBe(false);
    expect(options.input.type).toBe('password');
    expect(options.input.autocomplete).toBe('current-password');
    expect(options.input.maxLength).toBe(256);
  });

  it('loads dialogs before UI and app in both runtimes', () => {
    const desktop = read('index.html');
    const mobile = read('mobile/index.html');
    expect(desktop.indexOf('js/dialogs.js')).toBeLessThan(desktop.indexOf('js/desktop-ui.js'));
    expect(mobile.indexOf('js/dialogs.js')).toBeLessThan(mobile.indexOf('js/ui.js'));
  });

  it('contains no native alert, confirm, or prompt calls in active runtime scripts', () => {
    const activeFiles = [
      'js/desktop-app.js',
      'mobile/js/app.js',
      'js/auth.js',
      'js/desktop-ui.js',
      'mobile/js/ui.js',
    ];
    const nativeCall = /(?:\b|window\.)(?:alert|confirm|prompt)\s*\(/;
    for (const file of activeFiles) expect(read(file), file).not.toMatch(nativeCall);
  });

  it('renders toast messages with textContent instead of message HTML', () => {
    const source = read('js/dialogs.js');
    expect(source).toContain('body.textContent = text');
    expect(source).not.toMatch(/body\.innerHTML\s*=\s*text/);
  });

  it('submits Enter only from the dialog input or confirm button', () => {
    const target = selector => ({ matches: query => query.split(',').map(item => item.trim()).includes(selector) });
    expect(dialogs.shouldSubmitOnEnterTarget(target('.ting-dialog-input'))).toBe(true);
    expect(dialogs.shouldSubmitOnEnterTarget(target('.ting-dialog-confirm'))).toBe(true);
    expect(dialogs.shouldSubmitOnEnterTarget(target('.ting-dialog-cancel'))).toBe(false);
    expect(dialogs.shouldSubmitOnEnterTarget(target('.ting-dialog-close'))).toBe(false);
    expect(dialogs.shouldSubmitOnEnterTarget(target('.ting-dialog-password-toggle'))).toBe(false);
  });

  it('exports state/back APIs for the Android hardware-back bridge', () => {
    expect(typeof dialogs.isOpen).toBe('function');
    expect(typeof dialogs.handleBack).toBe('function');
    expect(dialogs.isOpen()).toBe(false);
    expect(dialogs.handleBack()).toBe(false);
  });
});
