# HuDaGee

HuDaGee is a cross-platform account management app built with Tauri v2, SolidJS, Tailwind CSS, and Rust.
Supports **Windows** (desktop) and **Android** (mobile).

## Features

- 🔐 **端到端加密**: 所有账号数据使用 AES-256-GCM + PBKDF2 加密，仅存在于本地设备
- 📱 **跨平台**: Windows 桌面与 Android 移动端双端支持
- 🎨 **沉浸式暗色主题**: 可自定义强调色和背景
- 📋 **快捷复制**: 一键复制账号/密码，支持分享格式解析
- 🔄 **局域网同步**: 同一 Wi-Fi 下 Windows ↔ Android 加密同步（拉取合并后推回）

## Development

### 前置要求

- **Node.js** 18+
- **Rust** (via rustup)
- **Visual Studio Build Tools** (Windows, 需 `Desktop development with C++` 工作负载)
- **Android Studio** + SDK/NDK（仅构建 Android APK 时需要；自带 JBR，内含 `keytool`）

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

### Release 签名（仅打包正式版需要）

签名密钥与密码**不要**提交到 Git。本地配置步骤：

1. 生成 keystore（若 `src-tauri\gen\android\app\hudagee-keystore.jks` 尚不存在）。  
   Windows 上 `keytool` 通常**不在 PATH**，请使用 Android Studio 自带的 JBR：

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
& "$env:JAVA_HOME\bin\keytool.exe" -genkey -v `
  -keystore src-tauri\gen\android\app\hudagee-keystore.jks `
  -alias hudagee -keyalg RSA -keysize 2048 -validity 10000
```

按提示设置姓名与密码（后续写入 `keystore.properties`）。

2. 复制示例配置并填写真实密码：

```powershell
Copy-Item src-tauri\gen\android\keystore.properties.example `
  src-tauri\gen\android\keystore.properties
```

编辑 `src-tauri\gen\android\keystore.properties`：

```properties
storeFile=app/hudagee-keystore.jks
storePassword=你的仓库密码
keyAlias=hudagee
keyPassword=你的密钥密码
```

`*.jks`、`keystore.properties` 已在 `.gitignore` 中忽略。未配置时仍可构建 **debug** APK；**release** 仅在存在完整 `keystore.properties` 时才会挂接签名。

### 构建 Debug APK

推荐一键脚本（自动配置 NDK、编译前端/Rust 并打包）：

```powershell
# 在仓库根目录执行
powershell -ExecutionPolicy Bypass -File scripts/build-android-debug.ps1
```

或按下面步骤手动执行。

> **注意**：
>
> - 手动 `cargo build` 生产库依赖 `Cargo.toml` 中的 `default = ["custom-protocol"]`。缺少该 feature 会走开发模式并请求 `http://localhost:1420/`，安装后白屏。
> - 手动 `cargo build --target aarch64-linux-android` **之前必须先设置 NDK 环境变量**，否则会报找不到 `aarch64-linux-android-clang`。
> - 也可复制 `src-tauri/.cargo/config.toml.example` 为 `config.toml` 并填写本机 NDK 路径（该文件已 gitignore，勿提交）。

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
# 将版本号换成本机 ndk 目录下实际版本（看 %LOCALAPPDATA%\Android\Sdk\ndk\）
$env:ANDROID_NDK_HOME = "$env:ANDROID_HOME\ndk\29.0.13846066"
$env:NDK_HOME = $env:ANDROID_NDK_HOME
$prebuilt = "$env:ANDROID_NDK_HOME\toolchains\llvm\prebuilt\windows-x86_64"
$env:Path = "$prebuilt\bin;$env:Path"
# minSdk 24 → 使用 android24 clang
$env:CC_aarch64_linux_android = "$prebuilt\bin\aarch64-linux-android24-clang.cmd"
$env:AR_aarch64_linux_android = "$prebuilt\bin\llvm-ar.exe"
$env:CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER = "$prebuilt\bin\aarch64-linux-android24-clang.cmd"
```

然后按步骤构建（均在**仓库根目录**）：

```powershell
# 0. 先打包前端（嵌入到 Rust 库）
npm run build

# 1. 编译 Rust 代码（生产模式，使用 frontendDist）
cargo build --target aarch64-linux-android --manifest-path src-tauri/Cargo.toml --lib --release

# 2. 复制 .so 到 jniLibs
Copy-Item src-tauri\target\aarch64-linux-android\release\libhudagee_lib.so `
  src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a\libhudagee_lib.so -Force

# 3. Gradle 打包（跳过内置 Rust 任务）
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
Set-Location src-tauri\gen\android
.\gradlew assembleArm64Debug --no-daemon `
  -x app:rustBuildArm64Debug `
  -x app:rustBuildArmDebug `
  -x app:rustBuildX86Debug `
  -x app:rustBuildX86_64Debug `
  -x app:rustBuildUniversalDebug
Set-Location ..\..\..
```

> **注意**：`-x` 跳过 Gradle 内的 Rust 构建（已在第 1 步手动完成），同时避免 Windows 符号链接权限不足，以及旧版脚本 `--copy` 参数与当前 CLI 不兼容的问题。当前一键脚本只打 **arm64-v8a**（与手动复制的 `.so` 一致），不要用 `assembleUniversal*` 除非已为各 ABI 都编好原生库。

APK 产物位于：

```text
src-tauri\gen\android\app\build\outputs\apk\arm64\debug\app-arm64-debug.apk
```

### 安装 APK

`adb` 同样通常不在 PATH，可使用 SDK 自带路径：

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r `
  src-tauri\gen\android\app\build\outputs\apk\arm64\debug\app-arm64-debug.apk
```

## 局域网同步

两端需在同一 Wi-Fi（**真机**），且**主密码一致**。

1. **电脑端**：配置 → 局域网同步 → 选择「服务端」→ 启动服务，记下本机 IP（如 `192.168.*`）与配对码
2. **手机端**：设置 → 局域网同步 → 填写电脑 IP 与端口（无需 `http://`，默认示例为 `192.168.1.100:9876`）和配对码 → 一键同步
3. 同步流程：拉取远程 → 本地合并 → 保存 → 推回远程，双方新增数据都会保留

> 客户端会记住上次填写的 IP、端口和配对码。Android 已允许明文 HTTP（局域网同步需要）；传输的 vault 仍为端到端加密。
>
> **模拟器注意**：模拟器显示的 `10.0.2.16` 等地址仅在模拟器虚拟网内有效，PC 的 `192.168.*` **无法直接连过去**。推荐电脑开服务端、真机当客户端。模拟器访问宿主机请用 `10.0.2.2`。

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

### `keytool` / `adb` 不是内部或外部命令

未把 JDK / platform-tools 加入 PATH。使用 Android Studio JBR 与 SDK 绝对路径：

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
& "$env:JAVA_HOME\bin\keytool.exe" -help
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
```

### `icons/icon.ico` not found

准备方形 PNG 图标，重新生成：

```powershell
npm run tauri icon app-icon.png
npm run tauri build
```

### Android 构建符号链接失败

Windows 默认不允许创建符号链接。解决方案：

1. **推荐**：启用开发者模式（设置 → 更新和安全 → 开发者选项）
2. **替代**：按上方 APK 构建步骤手动复制 `.so` 并 `-x` 跳过 Gradle 的 Rust 构建任务

### `Failed to request http://localhost:1420/`

安装的 APK 走了开发模式（未启用 `custom-protocol`），会去连电脑上的 Vite。请确认：

1. `src-tauri/Cargo.toml` 含 `default = ["custom-protocol"]`
2. 打包前先执行 `npm run build`
3. 重新 `cargo build --release`（Android 目标）并复制 `.so` 后再打 APK

日常联调请用 `npm run tauri android dev`（会连开发服）；模拟器访问宿主机请用 `10.0.2.2` 而非 `localhost`。

### `failed to find tool "aarch64-linux-android-clang"` / `clang.exe`

手动 `cargo build --target aarch64-linux-android` 时未配置 NDK。请：

- 优先使用 `scripts/build-android-debug.ps1`，或
- 按上文「构建 Debug APK」设置 NDK 环境变量后再编译（NDK 版本以 `%LOCALAPPDATA%\Android\Sdk\ndk\` 下实际目录为准）
