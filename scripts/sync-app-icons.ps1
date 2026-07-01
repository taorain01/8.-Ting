param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$sourceIcon = Join-Path $Root 'assets/icons/icon-512.png'
$winBuildDir = Join-Path $Root 'DongGoi/build'
$androidRes = Join-Path $Root 'android/app/src/main/res'

if (!(Test-Path $sourceIcon)) {
    throw "Missing source icon: $sourceIcon"
}

function Ensure-Dir([string]$Path) {
    if (!(Test-Path $Path)) {
        New-Item -ItemType Directory -Force -Path $Path | Out-Null
    }
}

function New-TransparentBitmap([int]$Width, [int]$Height) {
    $bitmap = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $bitmap.SetResolution(96, 96)
    return $bitmap
}

function Save-ResizedPng([System.Drawing.Image]$Source, [string]$Target, [int]$Size) {
    Ensure-Dir (Split-Path -Parent $Target)
    $bitmap = New-TransparentBitmap $Size $Size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($Source, 0, 0, $Size, $Size)
        $bitmap.Save($Target, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

# Draws the source centered at $Scale of the canvas on a transparent background.
# Used for adaptive icon foreground so the logo stays inside Android's safe zone
# (the outer ~25% of an adaptive icon can be clipped by the launcher mask).
function Save-InsetPng([System.Drawing.Image]$Source, [string]$Target, [int]$Size, [double]$Scale) {
    Ensure-Dir (Split-Path -Parent $Target)
    $bitmap = New-TransparentBitmap $Size $Size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $inner = [int][math]::Round($Size * $Scale)
        $offset = [int][math]::Round(($Size - $inner) / 2)
        $graphics.DrawImage($Source, $offset, $offset, $inner, $inner)
        $bitmap.Save($Target, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

function Write-TextFile([string]$Target, [string]$Content) {
    Ensure-Dir (Split-Path -Parent $Target)
    [System.IO.File]::WriteAllText($Target, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Write-IcoFromPngs([string[]]$PngPaths, [string]$Target) {
    Ensure-Dir (Split-Path -Parent $Target)
    $images = @()
    foreach ($pngPath in $PngPaths) {
        $bytes = [System.IO.File]::ReadAllBytes($pngPath)
        $image = [System.Drawing.Image]::FromFile($pngPath)
        try {
            $images += [pscustomobject]@{
                Width = [int]$image.Width
                Height = [int]$image.Height
                Bytes = $bytes
            }
        } finally {
            $image.Dispose()
        }
    }

    $stream = [System.IO.File]::Open($Target, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
    $writer = New-Object System.IO.BinaryWriter $stream
    try {
        $writer.Write([UInt16]0)
        $writer.Write([UInt16]1)
        $writer.Write([UInt16]$images.Count)
        $offset = 6 + (16 * $images.Count)
        foreach ($image in $images) {
            $entryWidth = if ($image.Width -ge 256) { 0 } else { $image.Width }
            $entryHeight = if ($image.Height -ge 256) { 0 } else { $image.Height }
            $writer.Write([byte]$entryWidth)
            $writer.Write([byte]$entryHeight)
            $writer.Write([byte]0)
            $writer.Write([byte]0)
            $writer.Write([UInt16]1)
            $writer.Write([UInt16]32)
            $writer.Write([UInt32]$image.Bytes.Length)
            $writer.Write([UInt32]$offset)
            $offset += $image.Bytes.Length
        }
        foreach ($image in $images) {
            $writer.Write($image.Bytes)
        }
    } finally {
        $writer.Dispose()
        $stream.Dispose()
    }
}

$source = [System.Drawing.Image]::FromFile($sourceIcon)
try {
    Ensure-Dir $winBuildDir
    $icoSizes = @(16, 24, 32, 48, 64, 128, 256)
    $icoPngs = @()
    foreach ($size in $icoSizes) {
        $png = Join-Path $env:TEMP "ting-icon-$size.png"
        Save-ResizedPng $source $png $size
        $icoPngs += $png
    }
    Write-IcoFromPngs $icoPngs (Join-Path $winBuildDir 'icon.ico')
    Save-ResizedPng $source (Join-Path $winBuildDir 'icon-transparent-preview.png') 256
    Save-ResizedPng $source (Join-Path $winBuildDir 'icon-test.png') 256

    $legacy = @{
        'mipmap-mdpi' = 48
        'mipmap-hdpi' = 72
        'mipmap-xhdpi' = 96
        'mipmap-xxhdpi' = 144
        'mipmap-xxxhdpi' = 192
    }
    foreach ($bucket in $legacy.Keys) {
        $dir = Join-Path $androidRes $bucket
        Save-ResizedPng $source (Join-Path $dir 'ic_launcher.png') $legacy[$bucket]
        Save-ResizedPng $source (Join-Path $dir 'ic_launcher_round.png') $legacy[$bucket]
    }

    $foreground = @{
        'mipmap-mdpi' = 108
        'mipmap-hdpi' = 162
        'mipmap-xhdpi' = 216
        'mipmap-xxhdpi' = 324
        'mipmap-xxxhdpi' = 432
    }
    foreach ($bucket in $foreground.Keys) {
        Save-InsetPng $source (Join-Path (Join-Path $androidRes $bucket) 'ic_launcher_foreground.png') $foreground[$bucket] 0.76
    }

    Write-TextFile (Join-Path $androidRes 'values/ic_launcher_background.xml') @'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FFFFFFFF</color>
</resources>
'@

    Write-TextFile (Join-Path $androidRes 'drawable/ic_launcher_background.xml') @'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#00000000"
        android:pathData="M0,0h108v108h-108z" />
</vector>
'@

    Write-TextFile (Join-Path $androidRes 'drawable-v24/ic_launcher_foreground.xml') @'
<?xml version="1.0" encoding="utf-8"?>
<bitmap xmlns:android="http://schemas.android.com/apk/res/android"
    android:src="@mipmap/ic_launcher_foreground"
    android:gravity="center" />
'@
} finally {
    $source.Dispose()
}

Write-Host "Synced Ting icons from assets/icons/icon-512.png"
