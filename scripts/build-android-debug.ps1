# HuDaGee Android debug APK 一键打包（需已安装 Android SDK/NDK）
# 用法（在仓库根目录）: powershell -ExecutionPolicy Bypass -File scripts/build-android-debug.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA "Android\Sdk" }
if (-not (Test-Path $sdk)) {
  throw "找不到 Android SDK: $sdk"
}

$ndkRoot = Join-Path $sdk "ndk"
$ndkVersions = @(Get-ChildItem $ndkRoot -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending)
if ($ndkVersions.Count -eq 0) {
  throw "找不到 NDK，请在 Android Studio 安装 NDK"
}
$ndk = $ndkVersions[0].FullName
$prebuilt = Join-Path $ndk "toolchains\llvm\prebuilt\windows-x86_64"
$clang = Join-Path $prebuilt "bin\aarch64-linux-android24-clang.cmd"
if (-not (Test-Path $clang)) {
  throw "找不到 NDK clang: $clang"
}

$env:ANDROID_HOME = $sdk
$env:ANDROID_NDK_HOME = $ndk
$env:NDK_HOME = $ndk
$env:Path = "$(Join-Path $prebuilt 'bin');$env:Path"
$env:CC_aarch64_linux_android = $clang
$env:AR_aarch64_linux_android = Join-Path $prebuilt "bin\llvm-ar.exe"
$env:CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER = $clang
$env:JAVA_HOME = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { "C:\Program Files\Android\Android Studio\jbr" }

Write-Host "NDK: $ndk"
Write-Host "=== 1/4 npm run build ==="
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

Write-Host "=== 2/4 cargo build (aarch64-linux-android) ==="
cargo build --target aarch64-linux-android --manifest-path src-tauri/Cargo.toml --lib --release
if ($LASTEXITCODE -ne 0) { throw "cargo build failed" }

Write-Host "=== 3/4 copy .so ==="
$srcSo = "src-tauri\target\aarch64-linux-android\release\libhudagee_lib.so"
$dstDir = "src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a"
New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
Copy-Item $srcSo (Join-Path $dstDir "libhudagee_lib.so") -Force

Write-Host "=== 4/4 gradle assembleUniversalDebug ==="
Set-Location "src-tauri\gen\android"
.\gradlew assembleUniversalDebug --no-daemon `
  -x app:rustBuildUniversalDebug `
  -x app:rustBuildArm64Debug `
  -x app:rustBuildArmDebug `
  -x app:rustBuildX86Debug `
  -x app:rustBuildX86_64Debug
if ($LASTEXITCODE -ne 0) { throw "gradle failed" }

$apk = Join-Path $Root "src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk"
Write-Host ""
Write-Host "完成: $apk"
Get-Item $apk | Format-List Length, LastWriteTime
