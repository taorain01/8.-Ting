# Dong goi app Ting!

Thu muc nay dung de ghi chu va chuan bi phan dong goi app thanh file cai dat
Windows `.exe`.

## Giai thich de hieu

### Electron la gi?

Electron giong nhu viec bo app web cua minh vao trong mot trinh duyet Chrome
rieng, kem them Node.js de app co the chay nhu phan mem Windows.

Vi du de hinh dung:

- `index.html`, `css/`, `js/` la noi dung app.
- Electron tao mot cua so desktop.
- Cua so do mo app web ben trong.
- Ket qua la nguoi dung bam file `.exe` nhu phan mem binh thuong.

Uu diem:

- De lam nhat voi app hien tai.
- Hop voi HTML/CSS/JS san co.
- Nhieu tai lieu, nhieu vi du.
- Build `.exe` nhanh.

Nhuoc diem:

- File app nang hon vi kem Chromium.
- Ton RAM hon Tauri.

### Tauri la gi?

Tauri cung dong goi app web thanh app desktop, nhung khong kem Chrome rieng.
No dung WebView co san cua he dieu hanh va phan backend viet bang Rust.

Uu diem:

- File `.exe` nhe hon.
- Ton RAM it hon.
- Bao mat tot neu cau hinh dung.

Nhuoc diem:

- Kho setup hon Electron.
- Can cai Rust/toolchain.
- Voi project hien tai se mat cong hon.

## Nen chon cai nao?

Voi Ting! hien tai, nen chon Electron truoc.

Ly do:

- Project dang la web app vanilla HTML/CSS/JS.
- Can dong goi nhanh thanh `.exe`.
- Co the dung truc tiep `index.html` hien co.
- Sau khi on dinh moi can toi uu bang Tauri.

## Huong dong goi de xuat

1. Tao cau hinh Electron trong project.
2. Dung `electron-builder` de build Windows `.exe`.
3. Tao lenh:
   - `npm run electron:dev` de chay thu.
   - `npm run dist:win` de build file `.exe`.
4. Kiem tra Demo mode, Email/Password Firebase.
5. Xu ly Google Login neu Firebase OAuth can cau hinh them cho desktop.

## Cau hinh da them

- `DongGoi/electron/main.cjs`: mo cua so desktop va load `index.html`.
- `DongGoi/build/icon.ico`: icon Windows tao tu `assets/icons/icon-512.png`.
- `package.json`:
  - `electron:dev`: chay thu app desktop.
  - `dist:win`: build bo cai dat Windows va ban portable.
  - `dist:unpacked`: build thu muc app co file `Ting!.exe`, khong tao installer.
  - `dist:portable`: chi build ban portable.

## Lenh su dung

```bash
npm install
npm run electron:dev
npm run dist:unpacked
npm run dist:win
```

Sau khi build thanh cong, file `.exe` nam trong `DongGoi/dist-electron/`.

Luu y: nut Google Login co the can cau hinh OAuth rieng cho desktop. Demo mode
va Email/Password la hai luong nen test truoc.
