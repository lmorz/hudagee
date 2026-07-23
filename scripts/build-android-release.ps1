# HuDaGee Android release APK 一键打包（需本地 keystore.properties）
# 用法（仓库根目录）: powershell -ExecutionPolicy Bypass -File scripts/build-android-release.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$keystoreProps = Join-Path $Root "src-tauri\gen\android\keystore.properties"
if (-not (Test-Path $keystoreProps)) {
  throw @"
缺少签名配置: src-tauri\gen\android\keystore.properties
请先复制 keystore.properties.example 并填写密码，且确保 app\hudagee-keystore.jks 存在。
"@
}

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

Write-Host "=== 2/4 cargo build (aarch64-linux-android release) ==="
cargo build --target aarch64-linux-android --manifest-path src-tauri/Cargo.toml --lib --release
if ($LASTEXITCODE -ne 0) { throw "cargo build failed" }

Write-Host "=== 3/4 copy .so ==="
$srcSo = "src-tauri\target\aarch64-linux-android\release\libhudagee_lib.so"
$dstDir = "src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a"
New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
Copy-Item $srcSo (Join-Path $dstDir "libhudagee_lib.so") -Force

Write-Host "=== 4/4 gradle assembleUniversalRelease ==="
Set-Location "src-tauri\gen\android"
.\gradlew assembleUniversalRelease --no-daemon `
  -x app:rustBuildUniversalRelease `
  -x app:rustBuildArm64Release `
  -x app:rustBuildArmRelease `
  -x app:rustBuildX86Release `
  -x app:rustBuildX86_64Release
if ($LASTEXITCODE -ne 0) { throw "gradle failed" }

$apk = Join-Path $Root "src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release.apk"
if (-not (Test-Path $apk)) {
  # some AGP versions name differently
  $apk = Get-ChildItem (Join-Path $Root "src-tauri\gen\android\app\build\outputs\apk") -Recurse -Filter "*release*.apk" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}
Write-Host ""
Write-Host "完成: $apk"
Get-Item $apk | Format-List Length, LastWriteTime
