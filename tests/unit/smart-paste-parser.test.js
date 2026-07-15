// ============================================================================
// Test cho DÁN THÔNG MINH — parseSmartPrice + parseSmartPasteBlock.
// Xem docs/spec-dan-thong-minh-va-wizard-2-tab.md (mục 6 — Verification).
//
// parser.js chạy dạng global trong browser; ở Node nó export qua module.exports
// (guard ở cuối file). Vì parser tham chiếu globalThis.TING_PLATFORM_ICONS,
// ta nạp trong vm sandbox tối thiểu để không phụ thuộc file khác.
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const PARSER_SRC = fs.readFileSync(path.join(ROOT, 'js', 'parser.js'), 'utf8');

function loadParser() {
    const sandbox = {
        console,
        Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON, RegExp,
        parseInt, parseFloat, isNaN, URL, encodeURIComponent, decodeURIComponent,
        module: { exports: {} },
    };
    sandbox.globalThis = sandbox;
    sandbox.exports = sandbox.module.exports;
    vm.createContext(sandbox);
    vm.runInContext(PARSER_SRC, sandbox);
    return sandbox.module.exports;
}

const P = loadParser();

describe('parseSmartPrice — quy ước giá (D2/D6)', () => {
    const cases = [
        ['30k', 30000],
        ['30n', 30000],
        ['1tr', 1000000],
        ['1m', 1000000],
        ['2m', 2000000],
        ['1.5tr', 1500000],
        ['1,5tr', 1500000],
        ['20.000', 20000],
        ['20,000', 20000],
        ['1.000.000', 1000000],
        ['20000', 20000],
        ['50000đ', 50000],
        ['50k', 50000],
        ['30', null],        // <=999 trần = thời hạn, không phải giá
        ['999', null],
        ['abc', null],
        ['50k likes', null], // cả dòng có chữ thừa
        ['', null],
        [null, null],
    ];
    it.each(cases)('parseSmartPrice(%p) = %p', (input, expected) => {
        expect(P.parseSmartPrice(input)).toBe(expected);
    });
});

describe('parseSmartPasteBlock — 6 ví dụ bẫy người dùng đưa', () => {
    it('VD1: note có URL + giá + tele → note giữ URL, price, seller telegram, credential rỗng', () => {
        const r = P.parseSmartPasteBlock('note: https://docs.google.com/abc\n30k\ntele: @shopne');
        expect(r.note).toContain('https://docs.google.com/abc');
        expect(r.price).toBe(30000);
        expect(r.seller).toBeTruthy();
        expect(r.seller.platform).toBe('telegram');
        expect(r.seller.name).toBe('@shopne');
        expect(r.credential.username).toBe('');
        expect(r.credential.password).toBe('');
    });

    it('VD2: tk/mk/2fa từng dòng + giá + zalo sđt', () => {
        const r = P.parseSmartPasteBlock('user@mail.com\npassword123\n123456\n30k\nzalo 9448298185');
        expect(r.credential.username).toBe('user@mail.com');
        expect(r.credential.password).toBe('password123');
        expect(r.credential.twoFaCode).toBe('123456');
        expect(r.price).toBe(30000);
        expect(r.seller).toBeTruthy();
        expect(r.seller.platform).toBe('zalo');
    });

    it('VD3: tk/mk/2fa (|) + giá + thời hạn 3 tháng', () => {
        const r = P.parseSmartPasteBlock('user@mail.com|pass|123456\n50k\n3 tháng');
        expect(r.credential.username).toBe('user@mail.com');
        expect(r.credential.password).toBe('pass');
        expect(r.credential.twoFaCode).toBe('123456');
        expect(r.price).toBe(50000);
        expect(r.duration).toBeTruthy();
        expect(r.duration.lifetime).toBe(false);
        expect(r.duration.text).toMatch(/3\s*thang/);
    });

    it('VD4: tk|mk (KHÔNG 2fa) + giá + note vipro → 2fa rỗng, note đúng', () => {
        const r = P.parseSmartPasteBlock('user@mail.com|secretpass\n50k\nnote: vipro');
        expect(r.credential.username).toBe('user@mail.com');
        expect(r.credential.password).toBe('secretpass');
        expect(r.credential.twoFaCode).toBe(''); // KHÔNG nhầm "vipro" thành 2fa
        expect(r.note).toBe('vipro');
        expect(r.price).toBe(50000);
    });

    it('VD5: tk|mk|2fa + note + giá + link shop trần', () => {
        const r = P.parseSmartPasteBlock('user@mail.com|pass|999888\nnote: hehe\n20k\nhttps://shop.vn');
        expect(r.credential.username).toBe('user@mail.com');
        expect(r.credential.password).toBe('pass');
        expect(r.credential.twoFaCode).toBe('999888');
        expect(r.note).toBe('hehe');
        expect(r.price).toBe(20000);
        expect(r.seller).toBeTruthy();
        expect(r.seller.url).toMatch(/shop\.vn/);
    });

    it('VD6: Key API 1 field + giá + tele → isApiKey, KHÔNG tách u/p', () => {
        const r = P.parseSmartPasteBlock('sk-abcdef123456789\n20k\ntele: @shopvn');
        expect(r.credential.isApiKey).toBe(true);
        expect(r.credential.username).toBe('sk-abcdef123456789');
        expect(r.credential.password).toBe('');
        expect(r.price).toBe(20000);
        expect(r.seller.platform).toBe('telegram');
        expect(r.seller.name).toBe('@shopvn');
    });

    it('VD6b: nhãn key: rõ ràng', () => {
        const r = P.parseSmartPasteBlock('key: sk-xyz\n20k');
        expect(r.credential.isApiKey).toBe(true);
        expect(r.credential.username).toBe('sk-xyz');
        expect(r.price).toBe(20000);
    });

    it('chuỗi rỗng → mọi field rỗng, không lỗi', () => {
        const r = P.parseSmartPasteBlock('');
        expect(r.price).toBe(null);
        expect(r.duration).toBe(null);
        expect(r.seller).toBe(null);
        expect(r.note).toBe('');
        expect(r.credential.username).toBe('');
    });

    it('vĩnh viễn → duration.lifetime = true', () => {
        const r = P.parseSmartPasteBlock('user|pass\nvĩnh viễn');
        expect(r.duration).toBeTruthy();
        expect(r.duration.lifetime).toBe(true);
    });

    it('form nhanh tách metadata và credential, hỗ trợ gói + ngày tùy ý', () => {
        const r = P.parseSmartPasteBlock([
            'note: tài khoản khách VIP',
            'gia: 50000',
            'shop: shop test',
            'ngay: 15/07/2026 30',
            'goi: ChatGPT Plus',
            '',
            'user@mail.com|secret|123456',
        ].join('\n'));
        expect(r.note).toBe('tài khoản khách VIP');
        expect(r.price).toBe(50000);
        expect(r.seller.name).toBe('shop test');
        expect(r.duration.text).toBe('15/07/2026 30');
        expect(r.plan).toBe('ChatGPT Plus');
        expect(r.credential.username).toBe('user@mail.com');
        expect(r.credential.password).toBe('secret');
        expect(r.credential.twoFaCode).toBe('123456');
    });

    it('form nhanh cho phép bỏ 2FA và đảo thứ tự metadata', () => {
        const r = P.parseSmartPasteBlock('goi: Plus\nshop: seller\nnote: abc\nuser@mail.com|secret');
        expect(r.plan).toBe('Plus');
        expect(r.note).toBe('abc');
        expect(r.credential.username).toBe('user@mail.com');
        expect(r.credential.password).toBe('secret');
        expect(r.credential.twoFaCode).toBe('');
    });
});
