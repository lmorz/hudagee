# HuDaGee 开发计划

> 目标：将 HuDaGee 打包为 Android 应用，并实现 Windows 与 Android 在同一局域网（无外网）下的账号数据同步。

---

## 概述

- **当前状态**：Tauri v2 桌面应用（SolidJS + Tailwind CSS + Rust），Windows 安装包已可正常构建
- **开发环境**：已安装 Android Studio + SDK/NDK
- **实施策略**：分两个里程碑依次推进
- **分支策略**：创建 `feature/android` 分支进行开发

---

## 里程碑一：Android 打包适配

### 目标

让 HuDaGee 能在 Android 设备上正常编译、安装和运行，核心数据管理功能完整可用。

### 阶段 1.1 — Rust 后端平台适配

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 1.1.1 | 条件编译 `windows_subsystem` | `src-tauri/src/main.rs` | Android 编译时跳过 `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` |
| 1.1.2 | 条件编译托盘图标代码 | `src-tauri/src/lib.rs` | `TrayIconBuilder`、`on_menu_event`、`on_tray_icon_event` 用 `#[cfg(desktop)]` 包裹 |
| 1.1.3 | 条件编译窗口关闭事件 | `src-tauri/src/lib.rs` | `on_window_event` 中的 `CloseRequested` → `prevent_close()` + `hide()` 用 `#[cfg(desktop)]` 包裹 |
| 1.1.4 | 条件编译 macOS Dock 事件 | `src-tauri/src/lib.rs` | `.run()` 中的 `RunEvent::Reopen` 用 `#[cfg(target_os = "macos")]` 包裹 |

### 阶段 1.2 — 前端 Tauri 调用适配

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 1.2.1 | 添加 isMobile 检测工具 | `src/lib/tauri.ts` | 新增 `isMobilePlatform()` 函数 |
| 1.2.2 | 条件执行全局快捷键初始化 | `src/App.tsx` | `onMount` 中的 `initWindowToggleShortcut` 在 Android 上跳过 |
| 1.2.3 | 条件执行开机自启初始化 | `src/App.tsx` | `initLaunchAtStartup` 在 Android 上跳过 |
| 1.2.4 | 条件执行窗口显示逻辑 | `src/App.tsx` | `revealMainWindow` 在 Android 上跳过 |
| 1.2.5 | 简化备份导入导出交互 | `src/lib/backup.ts` | Android 上 Tauri dialog 可用，保留现有逻辑 |

### 阶段 1.3 — Android 平台能力配置

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 1.3.1 | 运行 `npm run tauri android init` | 终端 | 生成 `src-tauri/gen/android/` 目录 |
| 1.3.2 | 创建 Android 专用能力配置 | `src-tauri/capabilities/mobile.json` | 基于 `default.json` 创建，移除桌面专属权限（`autostart`、`global-shortcut`、`window:allow-*` 等），引用 `mobile-schema.json` |
| 1.3.3 | 配置 Android 应用信息 | `src-tauri/gen/android/app/build.gradle.kts` | 确保 `applicationId`、`versionCode` 等与桌面端一致 |
| 1.3.4 | 配置 Android 网络权限 | `src-tauri/gen/android/app/src/main/AndroidManifest.xml` | 添加 `INTERNET` 权限（为后续局域网同步做准备） |

### 阶段 1.4 — 移动端精简 UI

#### 1.4.1 创建移动端组件目录结构

```
src/components/mobile/
├── MobileApp.tsx              ← 移动端主布局
├── MobileAuthView.tsx         ← 移动端认证页（复用现有逻辑，优化触摸交互）
├── MobileAccountList.tsx      ← 卡片式角色名列表
├── MobileAccountCard.tsx      ← 单张角色卡片（默认折叠，点击展开详情）
├── MobileAccountForm.tsx      ← 全屏表单（添加/编辑账号）
└── MobileSettings.tsx         ← 精简设置页（仅保留外观、职业配置、重置密码）
```

#### 1.4.2 组件设计要点

**`MobileApp`**（移动端主布局）
- 顶栏：标题 + 锁定按钮 + 设置入口
- 分组切换：水平滑动 tabs 或底部分段选择器
- 搜索栏：固定在分组下方
- 角色卡片列表：垂直滚动
- FAB 浮动按钮：添加账号

**`MobileAccountCard`**（角色卡片）
- 默认状态：显示职业标签 + 角色名，右侧展开箭头 `>` */
- 展开状态：显示账号（默认隐藏，眼睛按钮切换）、密码（默认隐藏，眼睛按钮切换）、备注
- 操作按钮：复制账号、复制密码、编辑、分享、删除
- 触摸友好：按钮尺寸 ≥ 44px

**`MobileAccountForm`**（全屏表单）
- 分组选择（下拉）
- 职业选择（下拉）
- 角色名输入
- 账号输入
- 密码输入
- 备注输入
- 保存按钮（底部固定）

**`MobileSettings`**（精简设置）
- 外观：主题选择（与 PC 端共用 `AppearanceSettings` 组件逻辑）
- 职业配置：添加/删除职业（与 PC 端共用逻辑）
- 重置主密码
- 关于信息

#### 1.4.3 响应式路由

在 `App.tsx` 中新增平台检测：

```tsx
function isMobilePlatform() {
  // Android Tauri 运行时或小屏幕浏览器
  return isTauriRuntime() && /* 检测平台为 Android */;
}
```

根据检测结果渲染 `MobileApp` 或现有桌面 `App`。

### 阶段 1.5 — 移动端 CSS

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 1.5.1 | 创建移动端样式 | `src/style-mobile.css` | 卡片列表、触摸友好按钮、底部弹出动画等 |
| 1.5.2 | 更新全局 CSS | `src/style.css` | 添加 `@media (max-width: 640px)` 断点，调整 `body` 的 `min-width` 限制 |

### 阶段 1.6 — 构建与验证

| # | 任务 | 说明 |
|---|------|------|
| 1.6.1 | `npm run tauri android build -- --debug` | 首次构建，解决编译错误 |
| 1.6.2 | 安装 APK 到模拟器或真机 | `adb install` |
| 1.6.3 | 功能验证：创建保险库、增删改查账号、搜索、复制、导入导出 | 确保核心流程完整 |
| 1.6.4 | 修复发现的问题 | 迭代直到 Android 端核心功能稳定 |

---

## 里程碑二：局域网同步

### 目标

实现 Windows 和 Android 设备在同一局域网（无互联网）下互相传输加密 vault 数据。

### 设计概要

- **传输协议**：HTTP（一端启动轻量级 `axum` 服务器，另一端作为客户端连接）
- **数据格式**：加密后的 `VaultEnvelope`（JSON），全程已 AES-256-GCM 加密
- **安全机制**：配对码验证（6 位数字）+ vault 自身加密（双重保障）
- **发现方式**：手动输入对方 IP 地址（后续可升级为 mDNS 自动发现）
- **冲突策略**：合并式双向同步（Merge-based），利用已有的 `mergeVaultData` 函数合并双方数据，不丢失任何一方的新增内容

### 阶段 2.1 — Rust 后端同步服务

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 2.1.1 | 新增 Rust 依赖 | `src-tauri/Cargo.toml` | 添加 `tokio`（full features）、`axum`、`tower-http`（cors feature）、`reqwest` |
| 2.1.2 | 创建同步模块 | `src-tauri/src/sync.rs` | HTTP 服务端 + 客户端逻辑 |
| 2.1.3 | 注册同步 commands | `src-tauri/src/lib.rs` | 新增 `start_sync_server`、`stop_sync_server`、`sync_pull`、`sync_push` 四个 Tauri commands |

#### sync.rs 核心接口

```rust
// 请求/响应数据结构

// 同步请求（推送/拉取通用）
struct SyncRequest {
    pair_code: String,         // 6 位配对码
}

// 推送时携带的 vault 数据
struct VaultPush {
    pair_code: String,
    envelope: String,          // 加密后的 VaultEnvelope JSON
    sha256: String,            // envelope 的 SHA-256 哈希（传输完整性校验）
}

// 同步响应
struct SyncResponse {
    success: bool,
    message: String,
    sha256: Option<String>,    // 返回数据的 SHA-256 哈希
    summary: Option<MergeSummary>,  // 合并结果摘要
}

struct MergeSummary {
    added_servers: u32,
    merged_servers: u32,
    added_accounts: u32,
    skipped_accounts: u32,
    added_professions: u32,
}

// 服务端 API
// GET  /api/ping               → 心跳检测（查找服务是否在线）
// POST /api/pair               → 验证配对码
// GET  /api/vault              → 返回 { envelope, sha256 }（加密 vault + 哈希）
// POST /api/vault              → 接收加密 vault，解密后 merge 到本地并保存，返回合并摘要

// 客户端 Tauri Commands
// start_sync_server(port)      → 在 0.0.0.0:{port} 启动 HTTP 服务端
// stop_sync_server()           → 停止服务端
// sync_pull(remote_url, pair_code) → 从远程拉取 vault → 本地 mergeVaultData → 保存
// sync_push(remote_url, pair_code)  → 推送本地 vault 到远程 → 远程 mergeVaultData → 返回摘要
```

### 阶段 2.2 — 前端同步 UI

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 2.2.1 | 添加同步状态管理 | `src/App.tsx` | 新增同步相关 signals：`syncMode`、`syncPort`、`syncStatus`、`remoteAddress` 等 |
| 2.2.2 | 创建同步面板组件 | `src/components/SyncPanel.tsx` | 服务端/客户端切换、IP 端口输入、状态显示 |
| 2.2.3 | 集成到设置面板 | `src/components/SettingsPanel.tsx` | 新增"数据同步"标签页 |
| 2.2.4 | 同步操作确认对话框 | `src/components/SyncConfirmDialog.tsx` | 推送/拉取前显示变更摘要，让用户确认 |

#### SyncPanel UI 设计

**服务端模式**（在你想分享数据的设备上开启）：
```
┌──────────────────────────┐
│ ● 同步服务运行中           │
│ 本机地址: 192.168.1.100   │
│ 端口: 9876                │
│ 配对码: 582491            │
│                          │
│ [停止同步]  [刷新本机 IP]  │
└──────────────────────────┘
```

**客户端模式**（在你要接收数据的设备上操作）：
```
┌──────────────────────────┐
│ 目标 IP:  192.168.1.100  │
│ 端口:     9876           │
│ 配对码:   582491         │
│                          │
│ [测试连接]       [拉取数据]│
│ [推送数据]                │
├──────────────────────────┤
│ 上次同步结果：             │
│ 新增 2 个分组             │
│ 合并 1 个同名分组         │
│ 导入 5 条账号             │
│ 跳过 0 条重复             │
└──────────────────────────┘
```

### 阶段 2.3 — 同步核心流程

> 同步使用项目已有的 `mergeVaultData` 函数进行合并（该函数来自 `src/lib/utils.ts`，已用于备份导入），保证**双方数据都被保留，不会因覆盖而丢失**。

#### 推送流程（本地 → 远程）

```
1. 用户点击"推送数据"

2. 本地：
   a. 从 vault() 获取当前 VaultData
   b. 用主密码加密 → 得到 VaultEnvelope JSON
   c. 计算 envelope 的 SHA-256 哈希
   d. 携带配对码 POST 到 http://{remote}:{port}/api/vault

3. 远程（HTTP 服务端）：
   a. 验证配对码（错误则返回 403）
   b. 接收 VaultEnvelope JSON，计算 SHA-256 与请求中的值比对
      └─ 不匹配 → 返回 400 "数据传输损坏，请重试"
   c. 读取远程本地的 vault 文件
   d. 用主密码分别解密远程本地 vault 和收到的 vault
   e. 调用 mergeVaultData(远程本地 vault, 收到的 vault)
      └─ 合并策略：
         · 分组：按 ID 或名称匹配，同名合并，新名新增
         · 账号：按"角色名+分组"和"账号+分组"去重，重复跳过
         · 职业：新增不重复的职业
   f. 加密合并后的 vault 并写入远程磁盘
   g. 返回合并摘要给本地 { addedAccounts, skippedAccounts, ... }

4. 本地收到响应：
   a. 显示合并摘要："推送完成！新增 3 条账号，跳过 1 条重复"
   b. 如果服务端 vault 中包含本地没有的数据 → 建议用户再执行一次"拉取"
```

#### 拉取流程（远程 → 本地）

```
1. 用户点击"拉取数据"

2. 本地：
   a. 携带配对码 GET http://{remote}:{port}/api/vault
   b. 服务端返回 { envelope (JSON), sha256 }

3. 本地校验：
   a. 计算收到的 envelope 的 SHA-256，与 sha256 字段比对
      └─ 不匹配 → 提示"数据传输损坏，请重试"
   b. 用本地主密码解密 envelope
      └─ 解密失败 → 提示"两端主密码不一致，请确认后再试"

4. 本地合并：
   a. 调用 mergeVaultData(本地 vault, 远程 vault)
   b. 显示合并摘要让用户确认：
      "将从远程合并以下内容：
       · 新增 2 个分组
       · 合并 1 个同名分组
       · 导入 5 条账号
       · 跳过 0 条重复
       是否继续？"
   c. 用户点击"确认合并"
   d. 调用 saveVault() 保存合并后的 vault
   e. 提示"拉取完成"

5. 如果远程有更新的数据而本地也有新增 → 建议再推送一次，让远程也拿到合并结果
```

#### 关键安全与正确性保障

| 保障措施 | 实现方式 |
|---------|---------|
| **传输完整性** | 每次传输附带 SHA-256 哈希，接收方校验 |
| **数据零丢失** | 使用 `mergeVaultData` 合并而非覆盖，重复项按规则跳过（不是删除） |
| **原子写入** | Tauri 的 `fs::write` 一次性写入整个 vault 文件，不会产生部分写入 |
| **配对码认证** | 6 位数字配对码，服务端验证后才响应数据请求 |
| **端到端加密** | vault 本身已用 AES-256-GCM 加密，即使 LAN 被嗅探也无法解密 |
| **双向最佳实践** | 推荐"先拉取再推送"：拉取远程数据合并到本地后，再推送回去，确保两端数据完全一致 |

### 阶段 2.4 — 跨平台验证

| # | 任务 | 说明 |
|---|------|------|
| 2.4.1 | 构建 Android APK（release） | `npm run tauri android build` |
| 2.4.2 | Windows ↔ Android 同步测试 | 同一 Wi-Fi 下互相推送/拉取 vault |
| 2.4.3 | Windows ↔ Windows 同步测试 | 双桌面端互传 |
| 2.4.4 | 断网环境验证 | 关闭路由器外网，仅保留局域网互通 |
| 2.4.5 | 合并正确性测试 | 两端各自添加不同账号后同步，验证双方数据都能保留 |
| 2.4.6 | 重复账号测试 | 两端添加了同一个角色名的账号，验证同步时正确跳过 |
| 2.4.7 | 传输损坏测试 | 模拟网络中断，验证 SHA-256 校验能正确拦截损坏数据 |
| 2.4.8 | 配对码错误测试 | 输入错误配对码验证能否正确拒绝 |
| 2.4.9 | 主密码不一致测试 | 两端使用不同主密码，验证能否正确提示 |
| 2.4.10 | 大 vault 数据传输 | 100+ 条账号下测试同步性能 |

---

## 里程碑时间预估

| 里程碑 | 阶段 | 预估工作量 |
|--------|------|-----------|
| **M1: Android 打包适配** | 1.1 Rust 后端适配 | 小（约 0.5 天） |
| | 1.2 前端 Tauri 调用适配 | 小（约 0.5 天） |
| | 1.3 Android 平台初始化 | 小（约 0.5 天） |
| | 1.4 移动端精简 UI | **大（约 2-3 天）** |
| | 1.5 移动端 CSS | 中（约 1 天） |
| | 1.6 构建验证 | 中（约 1 天） |
| **M2: 局域网同步** | 2.1 Rust 同步服务 | **大（约 2 天）** |
| | 2.2 前端同步 UI | 中（约 1 天） |
| | 2.3 同步流程集成 | 中（约 1 天） |
| | 2.4 跨平台验证 | 中（约 0.5 天） |

---

## 注意事项与风险

1. **Tauri Android 构建依赖**：需要安装 Android NDK（建议 r26+）、JDK 17+、Gradle 8+，已安装则跳过
2. **首次构建时间**：Rust 交叉编译到 ARM 架构，首次构建可能需要 10-30 分钟
3. **WebView 差异**：Android WebView（Chromium）与 PC 基本一致，CSS 兼容性风险低
4. **主密码一致性问题**：同步要求两端的主密码一致才能解密对方的数据，需要在 UI 中明确提示
5. **配对码安全**：6 位数字配对码提供基本防护，防止同一局域网内被无关设备随意访问
