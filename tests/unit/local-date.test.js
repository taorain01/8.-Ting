const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const UTILS = fs.readFileSync(path.join(ROOT, 'js', 'utils.js'), 'utf8');

function runInBangkok(source) {
  const script = `
    const vm = require('vm');
    const fs = require('fs');
    const src = fs.readFileSync(${JSON.stringify(path.join(ROOT, 'js', 'utils.js'))}, 'utf8');
    const sandbox = { Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON, console };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(src + '\\nconsole.log(formatLocalDateInput(new Date(\"2026-07-16T18:30:00.000Z\")));', sandbox);
  `;
  return execFileSync(process.execPath, ['-e', script], {
    env: { ...process.env, TZ: 'Asia/Bangkok' },
    encoding: 'utf8',
  }).trim();
}

describe('Local business date formatting', () => {
  it('does not move a Bangkok early-morning local date to the previous UTC date', () => {
    expect(runInBangkok(UTILS)).toBe('2026-07-17');
  });

  it('formats local Date components as YYYY-MM-DD', () => {
    const sandbox = { Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON, console };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(`${UTILS}\n;globalThis.__format = formatLocalDateInput;`, sandbox);
    const date = new Date(2026, 6, 17, 0, 30);
    expect(sandbox.__format(date)).toBe('2026-07-17');
  });

  it('formats and validates local purchase time as HH:mm', () => {
    const sandbox = { Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON, console };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(`${UTILS}\n;globalThis.__time = { formatLocalTimeInput, normalizeTimeInput, formatTimeVN, getAccountPurchaseTime };`, sandbox);

    expect(sandbox.__time.formatLocalTimeInput(new Date(2026, 6, 17, 8, 5))).toBe('08:05');
    expect(sandbox.__time.normalizeTimeInput('7:09')).toBe('07:09');
    expect(sandbox.__time.normalizeTimeInput('24:00', '')).toBe('');
    expect(sandbox.__time.formatTimeVN('18:45')).toBe('18:45');
  });

  it('prefers saved purchaseTime and falls back to createdAt for old accounts', () => {
    const sandbox = { Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON, console };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(`${UTILS}\n;globalThis.__getPurchaseTime = getAccountPurchaseTime;`, sandbox);

    expect(sandbox.__getPurchaseTime({ purchaseTime: '09:30', createdAt: new Date(2026, 6, 17, 15, 20) })).toBe('09:30');
    expect(sandbox.__getPurchaseTime({ createdAt: new Date(2026, 6, 17, 15, 20) })).toBe('15:20');
  });
});
