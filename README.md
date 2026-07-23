# HuDaGee

HuDaGee is a cross-platform account management app built with Tauri v2, SolidJS, Tailwind CSS, and Rust.
Supports **Windows** (desktop) and **Android** (mobile).

## Features

- 🔐 **端到端加密**: 所有账号数据使用 AES-256-GCM + PBKDF2 加密，仅存在于本地设备
- 📱 **跨平台**: Windows 桌面与 Android 移动端双端支持
- 🎨 **沉浸式暗色主题**: 可自定义强调色和背景
- 📋 **快捷复制**: 一键复制账号/密码，支持分享格式解析
- 🔄 **局域网同步**: 同一 Wi-Fi 下 Windows ↔ Android 加密同步（开发中）

## Development

### 前置要求

- **Node.js** 18+
- **Rust** (via rustup)
- **Visual Studio Build Tools** (Windows, 需 `Desktop development with C++` 工作负载)
- **Android Studio** + SDK/NDK (仅构建 Android APK 时需要)

### 安装依赖

```powershell
npm install
```

### 启动前端开发服务器

```powershell
npm run dev
```

### 运行前端生产构建

```powershell
npm run build
```

## Build Windows EXE

```powershell
npm install
npm run tauri build
```

首次构建可能需要 10-30 分钟（下载和编译 Rust 依赖）。

构建产物位于：

```text
src-tauri\target\release\bundle\nsis\HuDaGee_1.1.2_x64-setup.exe
```

免安装可执行文件：

```text
src-tauri\target\release\hudagee.exe
```

## Build Android APK

### 前置条件

- Android Studio 已安装，SDK 和 NDK 已配置
- Rust Android 编译目标已安装：

```powershell
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android i686-linux-android
```

### 初始化 Android 项目（仅首次）

```powershell
npm run tauri android init
```

### 构建 APK

```powershell
# 1. 编译 Rust 代码
cargo build --target aarch64-linux-android --manifest-path src-tauri/Cargo.toml --lib --release

# 2. 复制 .so 到 jniLibs
Copy-Item src-tauri\target\aarch64-linux-android\release\libhudagee_lib.so `
  src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a\libhudagee_lib.so -Force

# 3. 设置环境变量并运行 Gradle 打包
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
Set-Location src-tauri\gen\android
.\gradlew assembleUniversalDebug --no-daemon -x app:rustBuildArm64Debug
```

> **注意**：`-x app:rustBuildArm64Debug` 跳过 Rust 构建任务（已在第 1 步手动完成），同时避免 Windows 上符号链接权限不足的问题。

APK 产物位于：

```text
src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk
```

### 安装 APK

```powershell
adb install src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk
```

## Troubleshooting

### Rust 编译慢 / 卡在 `Updating crates.io index`

Rust 正在下载依赖元数据，等待几分钟即可，或检查网络/代理设置。

### Rust 未安装

```powershell
winget install Rustlang.Rustup
rustup default stable
```

### Visual Studio Build Tools 未安装

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
```

安装时选择 `Desktop development with C++` 工作负载。

### `icons/icon.ico` not found

准备方形 PNG 图标，重新生成：

```powershell
npm run tauri icon app-icon.png
npm run tauri build
```

### Android 构建符号链接失败

Windows 默认不允许创建符号链接。解决方案：

1. **推荐**：启用开发者模式（设置 → 更新和安全 → 开发者选项）
2. **替代**：按上方 APK 构建步骤手动复制 .so 文件并跳过 Rust 构建任务
src-tauri\icons\icon.ico
```
