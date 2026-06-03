# Updates the Coding Drives shortcut icons (Desktop + Start Menu, both per-
# user and machine-wide) to point at a freshly-built .ico, and forces the
# Windows shell icon cache to redraw so the change is visible immediately.
#
# Pass an empty -SourceImage to *clear* the override (shortcut falls back to
# the icon embedded in Coding Drives.exe, i.e. the bundled default).
#
# Why timestamped filenames: Windows aggressively caches shortcut icons
# keyed by the IconLocation string. Reusing the same .ico path lets the
# shell serve a stale thumbnail forever. By writing each upload to
# `icon-<unix-ms>.ico` and pointing the .lnk at the *new* path, the
# IconLocation string changes every time and Windows is forced to read the
# fresh bytes. Old icons are pruned (most-recent-3 kept) so disk doesn't
# leak.
#
# Output: a single JSON line on stdout describing the result, e.g.
#   {"ok":true,"updated":2,"icoPath":"C:\\…\\icon-1715234567890.ico"}
#   {"ok":false,"error":"…"}
# server.js parses the last line of stdout to surface back to the renderer.

[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]  [string]$ShortcutName,        # e.g. "Coding Drives"
  [Parameter(Mandatory=$false)] [string]$SourceImage  = "",   # raw upload path (empty = reset)
  [Parameter(Mandatory=$false)] [string]$IcoCachePath = ""    # explicit override; default = timestamped under userData
)

$ErrorActionPreference = "Continue"

function Write-StatusJson {
  param([bool]$Ok, [int]$Updated = 0, [string]$IcoPath = "", [string]$ErrText = "")
  $obj = [ordered]@{ ok = $Ok; updated = $Updated }
  if ($IcoPath) { $obj.icoPath = $IcoPath }
  if ($ErrText) { $obj.error   = $ErrText }
  Write-Output (ConvertTo-Json -InputObject $obj -Compress)
}

try { Add-Type -AssemblyName System.Drawing } catch { Write-StatusJson -Ok $false -ErrText "System.Drawing missing: $_"; exit 2 }

function Convert-ToSingleSizeIco {
  # Wraps a PNG-encoded resize of $Src as a one-image ICO file at $Dst.
  # Modern Windows accepts PNG-payload ICOs (since Vista) so this single
  # 256x256 entry is enough for high-DPI desktops and start-menu tiles.
  param([string]$Src, [string]$Dst)
  $ext = [IO.Path]::GetExtension($Src).ToLower()
  if ($ext -eq ".ico") { Copy-Item -LiteralPath $Src -Destination $Dst -Force; return }

  $img = [System.Drawing.Image]::FromFile($Src)
  try {
    $size = 256
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($img, 0, 0, $size, $size)
    $g.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $pngBytes = $ms.ToArray()

    # ICO file = header(6) + ICONDIRENTRY(16) + PNG payload.
    # Width/height bytes are 0 to indicate 256 (the format quirk).
    $header  = [byte[]]@(0,0,1,0,1,0)
    $szLE    = [BitConverter]::GetBytes([int]$pngBytes.Length)
    $offLE   = [BitConverter]::GetBytes([int]22)
    $entryHd = [byte[]]@(0, 0, 0, 0, 1, 0, 32, 0)
    $entry   = $entryHd + $szLE + $offLE
    [System.IO.File]::WriteAllBytes($Dst, $header + $entry + $pngBytes)
  } finally { $img.Dispose() }
}

# Win32 P/Invoke wrapper for SHChangeNotify. SHCNE_UPDATEITEM is the
# targeted "this specific .lnk's icon changed, redraw it" signal — much
# more reliable for shortcut redraws than the broad SHCNE_ASSOCCHANGED.
Add-Type -Namespace W32 -Name Shell -MemberDefinition @'
[DllImport("shell32.dll", CharSet = CharSet.Unicode)]
public static extern void SHChangeNotify(int eventId, int flags, System.IntPtr item1, System.IntPtr item2);
'@ -ErrorAction SilentlyContinue

function Notify-ShellItemChanged {
  param([string]$LnkPath)
  # SHCNE_UPDATEITEM = 0x00002000 ; SHCNF_PATHW = 0x0005
  $ptr = [System.Runtime.InteropServices.Marshal]::StringToHGlobalUni($LnkPath)
  try { [W32.Shell]::SHChangeNotify(0x00002000, 0x0005, $ptr, [System.IntPtr]::Zero) }
  finally { [System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr) }
}

function Update-LnkIcon {
  param([string]$LnkPath, [string]$IconPath)
  if (-not (Test-Path -LiteralPath $LnkPath)) { return $false }
  $sh  = New-Object -ComObject WScript.Shell
  $lnk = $sh.CreateShortcut($LnkPath)
  if ([string]::IsNullOrEmpty($IconPath)) {
    # Standalone-fallback: if the caller passes no icon (server.js always
    # does, even on reset — it substitutes the bundled creator icon — but
    # this branch lets the script work standalone) point IconLocation back
    # at the shortcut's own target .exe so Windows uses the embedded icon.
    $target = $lnk.TargetPath
    $lnk.IconLocation = if ($target) { "$target,0" } else { "" }
  } else {
    $lnk.IconLocation = "$IconPath,0"
  }
  $lnk.Save()
  # Touch the .lnk's LastWriteTime so the shell's directory watcher
  # notices the change. SHCNE_UPDATEITEM is the primary signal but the
  # mtime bump provides a second path for clients that listen to FS
  # change notifications.
  try { (Get-Item -LiteralPath $LnkPath).LastWriteTime = Get-Date } catch {}
  Notify-ShellItemChanged -LnkPath $LnkPath
  return $true
}

function Resolve-DefaultIcoPath {
  # Default cache directory under Electron userData: %APPDATA%\Coding Drives\data\shortcut-icons\
  $dataDir = Join-Path $env:APPDATA "$ShortcutName\data\shortcut-icons"
  if (-not (Test-Path -LiteralPath $dataDir)) { New-Item -Path $dataDir -ItemType Directory -Force | Out-Null }
  $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  return (Join-Path $dataDir ("icon-{0}.ico" -f $stamp))
}

function Prune-OldIcos {
  param([string]$IcoCachePath, [int]$Keep = 3)
  $dir = Split-Path -Parent $IcoCachePath
  if (-not (Test-Path -LiteralPath $dir)) { return }
  Get-ChildItem -LiteralPath $dir -Filter "icon-*.ico" -ErrorAction SilentlyContinue |
    Sort-Object -Property LastWriteTime -Descending |
    Select-Object -Skip $Keep |
    Remove-Item -Force -ErrorAction SilentlyContinue
}

# ── 1. Resolve the icon to use. Empty SourceImage = clear-override mode. ──
$applyIcon = ""
if (-not [string]::IsNullOrEmpty($SourceImage)) {
  if (-not (Test-Path -LiteralPath $SourceImage)) {
    Write-StatusJson -Ok $false -ErrText "Source image not found: $SourceImage"; exit 2
  }
  if ([string]::IsNullOrEmpty($IcoCachePath)) { $IcoCachePath = Resolve-DefaultIcoPath }
  try { Convert-ToSingleSizeIco -Src $SourceImage -Dst $IcoCachePath }
  catch { Write-StatusJson -Ok $false -ErrText "ICO conversion failed: $_"; exit 2 }
  $applyIcon = $IcoCachePath
}

# ── 2. Walk the four standard shortcut locations and update any that exist ──
$candidates = @(
  Join-Path ([Environment]::GetFolderPath("Desktop"))                "$ShortcutName.lnk"
  Join-Path ([Environment]::GetFolderPath("CommonDesktopDirectory")) "$ShortcutName.lnk"
  Join-Path ([Environment]::GetFolderPath("Programs"))               "$ShortcutName.lnk"
  Join-Path ([Environment]::GetFolderPath("CommonPrograms"))         "$ShortcutName.lnk"
)
$updated = 0
foreach ($p in $candidates) {
  try { if (Update-LnkIcon -LnkPath $p -IconPath $applyIcon) { $updated++ } } catch {}
}

# ── 3. Belt-and-suspenders cache refresh ──
# Per-shortcut SHCNE_UPDATEITEM already fired in Update-LnkIcon. The broad
# SHCNE_ASSOCCHANGED below tells every shell client (Desktop, Explorer,
# Taskbar) to drop cached icon associations. ie4uinit kicks the cache
# rebuilder. Both ship with Windows.
try { [W32.Shell]::SHChangeNotify(0x08000000, 0x0000, [System.IntPtr]::Zero, [System.IntPtr]::Zero) } catch {}
try { Start-Process -FilePath "ie4uinit.exe" -ArgumentList "-show" -NoNewWindow -Wait -ErrorAction SilentlyContinue } catch {}

# ── 4. Prune old timestamped ICOs so disk doesn't grow forever ──
if ($applyIcon) { Prune-OldIcos -IcoCachePath $applyIcon }

Write-StatusJson -Ok $true -Updated $updated -IcoPath $applyIcon
exit 0
