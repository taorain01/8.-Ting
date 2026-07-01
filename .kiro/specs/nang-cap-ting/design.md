# Thiết kế — Nâng cấp Ting!

## Kiến trúc file
- Dùng chung (cả desktop + mobile): `js/parser.js`, `js/platform-icons.js`, `js/platform-tags.js`, `js/utils.js`, `js/crypto.js`. Mobile lấy qua `scripts/prepare-android-web.js`.
- Desktop: `js/desktop-ui.js` (render), `js/desktop-app.js` (logic).
- Mobile: `mobile/js/ui.js`, `mobile/js/app.js`.
- CSS desktop: `css/components.css`; CSS mobile: `mobile/css/components.css`.
- `js/ui.js`, `js/app.js` (gốc) là legacy KHÔNG dùng — bỏ qua.

## Quyết định thiết kế
- **Icon app VN**: dùng thuộc tính `mark` (2 ký tự) + màu thương hiệu trong `platform-icons.js`, không cần file SVG.
- **TOTP**: thêm `generateTOTP`/`base32ToBytes`/`isLikelyTotpSecret`/`totpTimeRemaining` vào `crypto.js` (Web Crypto HMAC-SHA1). Widget live trong chi tiết, ticker toàn cục `window.tingTotpInterval` tự dừng khi phần tử biến mất.
- **Giá mua**: helper `parsePriceValue/formatPriceInput/formatPriceVN/formatPriceField` trong `utils.js`. Lưu field `purchasePrice` (number|null).
- **Người bán từ link**: `detectSellerFromText(text)` trong `parser.js` → `{platform,url,name,host}`. Lưu field `sellerLink`. Chi tiết dùng `openExternalLink`.
- **Hết hạn ngay**: `markAccountExpired(id)` đặt `expiryDate` = hôm qua, `status='expired'`.
- **Vừa thêm**: `window.appState.justAddedAccountId/justAddedAt`, `markAccountAsJustAdded`, `getJustAddedAccount` (hết hạn sau 2 phút), section đầu Dashboard.
- **Dọn tab**: port pattern toolbar+panel của mobile sang desktop; xoá hàm trùng lặp/chết trong `mobile/js/ui.js`.

## Data model bổ sung (Firestore, non-sensitive)
- `sellerLink: string`
- `purchasePrice: number | null`
