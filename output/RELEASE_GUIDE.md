# Huong Dan Release Ting!

Tai lieu nay la quy trinh release tu cac ban sau `1.3.5`. Lam theo checklist de co ca PC update va Android update.

## Nguyen tac truoc khi lam

- Khong commit token, PAT, `google-services.json`, file secret, hay log co token.
- Khong revert file dirty khong lien quan. Luon xem `git diff --name-only` truoc khi stage.
- Neu dang co user changes, chi `git add` dung file cua release.
- Dung `npm.cmd` tren PowerShell, tranh loi policy voi `npm.ps1`. Tuong tu, neu can chay `npx`, dung `npx.cmd` (khong dung `npx.ps1` vi bi chan execution policy).
- Tang version moi moi lan publish. Vi du da public `1.3.5` thi hotfix tiep theo la `1.3.6`, khong ghi de cung version.
- Android `versionCode` dung cong thuc: `major * 10000 + minor * 100 + patch`.
  - `1.3.6` -> `10306`
  - `1.4.0` -> `10400`
  - `1.5.0` -> `10500`

## 1. Chon version moi

Dat bien tam trong dau de tranh nham:

```powershell
$VERSION = "1.5.0"
$CODE = 10500
$TAG = "v$VERSION"
```

## 2. Bump version trong source

Can update cac file sau:

- `package.json`
- `package-lock.json`
- `android/app/build.gradle`
- `js/mobile-updater.js`
- `js/desktop-app.js`
- `js/desktop-ui.js`
- `mobile/js/app.js`
- `mobile/js/ui.js`
- Test lien quan version, thuong la `tests/unit/mobile-ui-update-section.test.js`

Tim version cu:

```powershell
rg -n "1\.3\.5|10305" package.json package-lock.json android js mobile tests -g "*.js" -g "*.json" -g "*.gradle"
```

Sau khi sua, kiem lai:

```powershell
rg -n "1\.3\.5|10305" package.json package-lock.json android js mobile tests -g "*.js" -g "*.json" -g "*.gradle"
rg -n "1\.3\.6|10306" package.json package-lock.json android js mobile tests -g "*.js" -g "*.json" -g "*.gradle"
```

## 3. Chay test

```powershell
npm.cmd test
```

Dieu kien pass:

- Tat ca test passed.
- Neu test fail do version expected, update test dung version moi.
- Neu fail do logic release/update, sua code truoc khi build.

### Luu y test flaky (property-based join-password)

Cac test property o `tests/property/join-password-*.test.js` dung PBKDF2 600000 vong (rat nang CPU) voi `numRuns` cao. Khi chay full suite song song, chung co the fail ngau nhien (flaky) do nghen CPU, khong phai bug that. Dau hieu:

- Fail o `join-password-crypto.test.js` / `join-password-flow.test.js` voi loi kieu `expect(ok).toBe(true)` hoac `Mat khau vao nhom khong dung`, nhung chay lai lai pass.

Cach xac nhan la flaky (khong phai bug):

```powershell
npx.cmd vitest run tests/property/join-password-crypto.test.js tests/property/join-password-flow.test.js
```

Neu chay rieng (it song song hon) ma pass het, coi nhu suite da xanh, tiep tuc release. Chi coi la bug that khi loi tai hien duoc mot cach xac dinh (deterministic) khi chay rieng.

## 4. Build Android APK

```powershell
npm.cmd run android:build:debug
```

Verify version trong APK:

```powershell
& "$env:USERPROFILE\.ting-android-toolchain\android-sdk\build-tools\35.0.0\aapt.exe" dump badging "android/app/build/outputs/apk/debug/app-debug.apk" |
  Select-String -Pattern "package:|versionCode|versionName"
```

Ket qua mong doi:

```text
versionCode='10306' versionName='1.3.6'
```

Copy APK ra `output`:

```powershell
Copy-Item -LiteralPath "android/app/build/outputs/apk/debug/app-debug.apk" -Destination "output/Ting-$VERSION.apk" -Force
```

## 5. Tao Android `version.json`

Khuyen nghi manifest tro toi raw APK tren nhanh `main` cua repo `ting-releases`. Cach nay giam loi redirect khi may dang cai ban updater cu.

```powershell
node scripts/write-release-manifest.cjs `
  --apk "output/Ting-$VERSION.apk" `
  --version $VERSION `
  --version-code $CODE `
  --asset-name "Ting-$VERSION.apk" `
  --apk-url "https://raw.githubusercontent.com/taorain01/ting-releases/main/Ting-$VERSION.apk" `
  --notes "Mo ta ngan gon thay doi trong ban $VERSION."
```

Kiem `output/version.json`:

```powershell
Get-Content -Raw -LiteralPath "output/version.json"
```

Can co:

- `latestVersion` dung version moi.
- `versionCode` dung code moi.
- `apkUrl` tro toi `raw.githubusercontent.com/.../Ting-$VERSION.apk`.
- `apkSize` va `apkSha256` duoc tao tu file APK moi.

## 6. Build Windows installer

```powershell
npm.cmd run dist:win
```

Copy installer va feed ra `output`:

```powershell
Copy-Item -LiteralPath "DongGoi/dist-electron/ting-setup-$VERSION.exe" -Destination "output/ting-setup-$VERSION.exe" -Force
Copy-Item -LiteralPath "DongGoi/dist-electron/latest.yml" -Destination "output/latest.yml" -Force
```

Kiem `latest.yml`:

```powershell
Get-Content -Raw -LiteralPath "output/latest.yml"
```

Can co:

- `version: $VERSION`
- `path: ting-setup-$VERSION.exe`
- `files.url: ting-setup-$VERSION.exe`
- `sha512` khop file installer.

Verify SHA512:

```powershell
$feed = Get-Content -Raw -LiteralPath "output/latest.yml"
$expected = [regex]::Match($feed, "sha512:\s*(\S+)").Groups[1].Value
$path = Resolve-Path "output/ting-setup-$VERSION.exe"
$sha = [Security.Cryptography.SHA512]::Create()
$actual = [Convert]::ToBase64String($sha.ComputeHash([IO.File]::ReadAllBytes($path)))
if ($actual -eq $expected) { "sha512 OK" } else { "sha512 MISMATCH" }
```

## 7. Kiem file artifacts local

```powershell
Get-ChildItem -LiteralPath "output" |
  Where-Object { $_.Name -match "$VERSION|latest\.yml|version\.json" } |
  Sort-Object Name |
  Select-Object Name,Length,LastWriteTime
```

Can thay:

- `Ting-$VERSION.apk`
- `ting-setup-$VERSION.exe`
- `latest.yml`
- `version.json`

## 8. Commit source

Kiem diff:

```powershell
git diff --name-only
git diff --check
git diff --stat
```

Stage chi file release/source lien quan. Vi du:

```powershell
git add -- `
  package.json `
  package-lock.json `
  android/app/build.gradle `
  android/app/src/main/java/app/ting/manager/TingUpdaterPlugin.java `
  js/mobile-updater.js `
  js/desktop-app.js `
  js/desktop-ui.js `
  mobile/js/app.js `
  mobile/js/ui.js `
  tests/unit/mobile-ui-update-section.test.js `
  tests/unit/mobile-updater-errors.test.js `
  DongGoi/build/installer.nsh
```

Kiem staged:

```powershell
git diff --cached --name-only
```

Commit va tag:

```powershell
git commit -m "Release $VERSION"
git tag $TAG
git push origin master
git push origin $TAG
```

## 9. Publish GitHub releases

Co 2 repo:

- Desktop/source: `taorain01/8.-Ting`
- Android release manifest/APK: `taorain01/ting-releases`

Can publish:

- Desktop release `$TAG`
  - `output/latest.yml`
  - `output/ting-setup-$VERSION.exe`
- Mobile release `$TAG`
  - `output/Ting-$VERSION.apk`
  - `output/version.json`
- Mobile repo branch `main`
  - `version.json`
  - `Ting-$VERSION.apk`

Neu co `gh` CLI thi co the dung:

```powershell
gh release create $TAG "output/latest.yml" "output/ting-setup-$VERSION.exe" `
  --repo taorain01/8.-Ting `
  --target master `
  --title "Ting! $VERSION" `
  --notes "Mo ta ngan gon thay doi."

gh release create $TAG "output/Ting-$VERSION.apk" "output/version.json" `
  --repo taorain01/ting-releases `
  --target main `
  --title "Ting! Android $VERSION" `
  --notes "Mo ta ngan gon thay doi."
```

Neu khong co `gh`, dung REST API voi token trong git credential store. Khong in token ra log.

Neu PowerShell bao `gh.exe is not recognized`, day la may chua cai GitHub CLI, khong phai loi artifact. Khong can cai `gh` giua release; chuyen ngay sang REST API ben duoi. Khi kiem tra `$LASTEXITCODE`, luu y loi `CommandNotFoundException` cua PowerShell co the khong dat exit code nhu chuong trinh native, vi vay nen kiem tra truoc bang `Get-Command gh -ErrorAction SilentlyContinue` thay vi chi dua vao `$LASTEXITCODE`.

Neu REST API tao release bao `400 Problems parsing JSON`, thuong la body JSON Unicode tu PowerShell bi gui sai encoding. Tao JSON dang compact, encode thanh UTF-8 bytes va gui bytes thay vi gui truc tiep chuoi PowerShell:

```powershell
$json = $Body | ConvertTo-Json -Depth 20 -Compress
$bytes = [Text.Encoding]::UTF8.GetBytes($json)
Invoke-RestMethod -Method Post -Uri $Uri -Headers $headers `
  -ContentType "application/json; charset=utf-8" -Body $bytes
```

Neu release notes khong can dau, co the dung notes ASCII de giam them rui ro encoding; van nen gui JSON bang UTF-8 bytes.

Script mau rut gon:

```powershell
$ErrorActionPreference = "Stop"
$VERSION = "1.3.6"
$TAG = "v$VERSION"

$credInput = "protocol=https`nhost=github.com`n`n"
$cred = $credInput | git credential fill
$tokenLine = $cred | Where-Object { $_ -like "password=*" } | Select-Object -First 1
if (-not $tokenLine) { throw "GitHub token not found in git credential store." }
$token = $tokenLine.Substring(9)

$headers = @{
  Authorization = "Bearer $token"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
  "User-Agent" = "Ting-release-publish"
}

function Invoke-GhJson {
  param([string]$Method, [string]$Uri, $Body = $null)
  if ($null -eq $Body) { return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers }
  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 20)
}

function Get-ReleaseByTag {
  param([string]$Repo, [string]$Tag)
  try { return Invoke-GhJson -Method Get -Uri "https://api.github.com/repos/$Repo/releases/tags/$Tag" }
  catch {
    $status = $null
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    if ($status -eq 404) { return $null }
    throw
  }
}

function Ensure-Release {
  param([string]$Repo, [string]$Tag, [string]$Target, [string]$Name, [string]$Body)
  $release = Get-ReleaseByTag -Repo $Repo -Tag $Tag
  if ($release) { return $release }
  return Invoke-GhJson -Method Post -Uri "https://api.github.com/repos/$Repo/releases" -Body @{
    tag_name = $Tag
    target_commitish = $Target
    name = $Name
    body = $Body
    draft = $false
    prerelease = $false
    make_latest = "true"
  }
}

function Remove-AssetIfExists {
  param($Release, [string]$Name)
  $asset = $Release.assets | Where-Object { $_.name -eq $Name } | Select-Object -First 1
  if ($asset) { Invoke-GhJson -Method Delete -Uri $asset.url | Out-Null }
}

function Upload-Asset {
  param([string]$Repo, $Release, [string]$Path, [string]$Name, [string]$ContentType)
  Remove-AssetIfExists -Release $Release -Name $Name
  $uploadUri = "https://uploads.github.com/repos/$Repo/releases/$($Release.id)/assets?name=$([uri]::EscapeDataString($Name))"
  Invoke-RestMethod -Method Post -Uri $uploadUri -Headers $headers -ContentType $ContentType -InFile $Path | Out-Null
}

function Get-ContentItem {
  param([string]$Repo, [string]$Path)
  try { return Invoke-GhJson -Method Get -Uri "https://api.github.com/repos/$Repo/contents/$Path`?ref=main" }
  catch {
    $status = $null
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    if ($status -eq 404) { return $null }
    throw
  }
}

function Put-RepoFile {
  param([string]$Repo, [string]$Path, [string]$LocalPath, [string]$Message)
  $existing = Get-ContentItem -Repo $Repo -Path $Path
  $bytes = [IO.File]::ReadAllBytes((Resolve-Path $LocalPath))
  $body = @{
    message = $Message
    content = [Convert]::ToBase64String($bytes)
    branch = "main"
  }
  if ($existing -and $existing.sha) { $body.sha = $existing.sha }
  Invoke-GhJson -Method Put -Uri "https://api.github.com/repos/$Repo/contents/$Path" -Body $body | Out-Null
}

$desktopRepo = "taorain01/8.-Ting"
$mobileRepo = "taorain01/ting-releases"

$desktopRelease = Ensure-Release -Repo $desktopRepo -Tag $TAG -Target "master" -Name "Ting! $VERSION" -Body "Release $VERSION."
Upload-Asset -Repo $desktopRepo -Release $desktopRelease -Path "output/latest.yml" -Name "latest.yml" -ContentType "text/yaml"
Upload-Asset -Repo $desktopRepo -Release $desktopRelease -Path "output/ting-setup-$VERSION.exe" -Name "ting-setup-$VERSION.exe" -ContentType "application/octet-stream"

$mobileRelease = Ensure-Release -Repo $mobileRepo -Tag $TAG -Target "main" -Name "Ting! Android $VERSION" -Body "Release $VERSION."
Upload-Asset -Repo $mobileRepo -Release $mobileRelease -Path "output/Ting-$VERSION.apk" -Name "Ting-$VERSION.apk" -ContentType "application/vnd.android.package-archive"
Upload-Asset -Repo $mobileRepo -Release $mobileRelease -Path "output/version.json" -Name "version.json" -ContentType "application/json"

Put-RepoFile -Repo $mobileRepo -Path "Ting-$VERSION.apk" -LocalPath "output/Ting-$VERSION.apk" -Message "Add Android APK $VERSION for direct updater download"
Put-RepoFile -Repo $mobileRepo -Path "version.json" -LocalPath "output/version.json" -Message "Update Android release manifest to $VERSION"

Write-Output "desktop_release=$($desktopRelease.html_url)"
Write-Output "mobile_release=$($mobileRelease.html_url)"
```

## 10. Smoke-check public release

Desktop latest feed:

```powershell
$r = Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/taorain01/8.-Ting/releases/latest/download/latest.yml"
if ($r.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($r.Content) } else { [string]$r.Content }
```

Mobile manifest raw:

```powershell
$r = Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/taorain01/ting-releases/main/version.json" -Headers @{"Cache-Control"="no-cache"; Pragma="no-cache"}
$r.Content
```

Kiem headers neu raw bi cache:

```powershell
$r.Headers.GetEnumerator() |
  Where-Object { $_.Key -match "cache|etag|last|age|expires|x-" } |
  Sort-Object Key |
  ForEach-Object { "$($_.Key): $($_.Value)" }
```

GitHub raw co `Cache-Control: max-age=300`. Neu vua update xong ma raw van tra noi dung cu, doi toi da 5 phut roi check lai.

Kiem asset HEAD:

```powershell
$urls = @(
  "https://github.com/taorain01/8.-Ting/releases/latest/download/ting-setup-$VERSION.exe",
  "https://raw.githubusercontent.com/taorain01/ting-releases/main/Ting-$VERSION.apk",
  "https://github.com/taorain01/ting-releases/releases/latest/download/version.json"
)

foreach ($u in $urls) {
  $r = Invoke-WebRequest -UseBasicParsing -Method Head -Uri $u
  [pscustomobject]@{
    Url = $u
    Status = $r.StatusCode
    Length = $r.Headers["Content-Length"]
    Type = $r.Headers["Content-Type"]
  }
}
```

Neu can verify APK public, uu tien so sanh HEAD size voi `apkSize`. Chi tai binary ve khi that su can, vi Windows Defender co the canh bao PowerShell download file `.apk`.

## 11. Test bang app that

PC:

1. Cai/mo ban cu.
2. Vao Settings -> Kiem tra.
3. Can thay version moi.
4. Bam Cap nhat.
5. Can thay `downloading` -> `downloaded` -> nut `Cai dat`.
6. Bam Cai dat, installer moi hien trang Ting! voi nut `Cai dat Ting!` lon.

Android:

1. Cai/mo ban cu.
2. Vao Settings -> Phien ban.
3. Bam `Kiem tra`.
4. Can thay version moi.
5. Bam `Cap nhat`.
6. Android tai APK, verify SHA256/size, roi mo trinh cai dat.
7. Sau khi cai, Settings phai hien `Ting! v$VERSION`.

## 12. Neu co loi hay gap

### Mobile bao "Tai that bai"

Kiem:

- `version.json` raw dang tro dung APK chua.
- `apkSize` va `apkSha256` co khop file APK public khong.
- APK public raw co HTTP 200 khong.
- Raw cache da het 5 phut chua.
- Ban app dang cai co native plugin updater moi chua. Neu dang o ban cu, dung raw APK URL de tranh redirect release asset.

### PC check thay available nhung khong download

Kiem:

- `latest.yml` public co version moi khong.
- `path` va `files.url` dung `ting-setup-$VERSION.exe` khong.
- SHA512 trong `latest.yml` khop file installer khong.
- Release desktop latest co asset `.exe` va `latest.yml` khong.

### Windows installer build fail voi NSIS

Kiem output `npm.cmd run dist:win`.

- Loi macro/function khong referenced trong uninstaller: boc UI custom trong `!ifndef BUILD_UNINSTALLER`.
- Loi `MUI_HEADER_TEXT` khong co: khong dung macro nay trong include qua som; tu render header trong custom page.
- Loi `warning treated as error`: xu ly warning, khong bo qua.

### Build dist:win fail voi "GitHub Personal Access Token is not set" / GH_TOKEN

Trieu chung: cuoi log co `Implicit publishing triggered by CI detection` roi `GitHub Personal Access Token is not set` va exit code 1, du chi muon build local. Nguyen nhan: chay trong moi truong co bien `CI` nen electron-builder tu kich hoat publish.

Cach xu ly (da fix gan trong repo): script `dist:win` da them `--publish never` nen build local khong bao gio tu publish. Neu van gap loi nay (vi du chay electron-builder truc tiep), phai truyen `--publish never`:

```powershell
npx.cmd electron-builder --win --x64 --publish never
```

Publish that su van lam thu cong qua REST API o muc 9, khong dua vao auto-publish cua electron-builder.

### `releaseNotes` trong `version.json` bi loi font / mojibake tren Windows

Trieu chung: chay `node scripts/write-release-manifest.cjs --notes "...tieng Viet co dau..."` tu PowerShell tao `version.json` co chu kieu `Tá»‘i giáº£n...` thay vi UTF-8 dung. Nguyen nhan la chuoi Unicode bi sai encoding khi truyen qua command-line Windows vao Node.

Cach xu ly an toan:

- Dung release notes ASCII/khong dau khi truyen truc tiep qua `--notes`, hoac sua script de doc notes tu file UTF-8 thay vi command-line.
- Sau khi tao manifest, luon mo `output/version.json` va kiem tra `releaseNotes` truoc khi publish.
- Neu da bi loi, chay lai lenh tao manifest voi notes ASCII; khong sua `apkSize`/`apkSha256` bang tay.

Vi du:

```powershell
node scripts/write-release-manifest.cjs `
  --apk "output/Ting-$VERSION.apk" `
  --version $VERSION `
  --version-code $CODE `
  --asset-name "Ting-$VERSION.apk" `
  --apk-url "https://raw.githubusercontent.com/taorain01/ting-releases/main/Ting-$VERSION.apk" `
  --notes "Toi gian form them tai khoan va bo sung dan nhanh."
```

## 13. Checklist ngan truoc khi bao xong

- `npm.cmd test` passed.
- `npm.cmd run android:build:debug` passed.
- APK `versionName/versionCode` dung.
- `npm.cmd run dist:win` passed.
- `output/Ting-$VERSION.apk` ton tai.
- `output/ting-setup-$VERSION.exe` ton tai.
- `output/latest.yml` version/path/SHA512 dung.
- `output/version.json` versionCode/apkUrl/apkSize/apkSha256 dung.
- Commit + tag da push.
- Desktop release latest co `latest.yml` va installer.
- Mobile release latest co APK va `version.json`.
- `ting-releases/main/version.json` va `Ting-$VERSION.apk` da update.
- Public smoke-check OK.
- Khong stage/commit file dirty khong lien quan.
