# HuDaGee

HuDaGee is a Tauri desktop app built with Vite, SolidJS, Tailwind CSS, and Rust.

## Development

Install dependencies:

```powershell
npm install
```

Start the frontend development server:

```powershell
npm run dev
```

Run a production frontend build:

```powershell
npm run build
```

## Build Windows EXE

Run the following commands in PowerShell:

```powershell
cd C:\Users\ReplaceToYourName\HuDaGee
npm install
npm run tauri build
```

The first Tauri build can take several minutes because Rust dependencies need to be downloaded and compiled.

After a successful build, the Windows installer is usually generated under:

```text
src-tauri\target\release\bundle\nsis\
```

Look for a file similar to:

```text
HuDaGee_0.0.0_x64-setup.exe
```

The unpackaged application executable may also be generated at:

```text
src-tauri\target\release\hudagee.exe
```

## Troubleshooting

If the build appears to pause at:

```text
Updating crates.io index
```

Rust is downloading dependency metadata. Wait a few minutes, or check your network/proxy settings.

If Rust is missing, install it with:

```powershell
winget install Rustlang.Rustup
```

Then restart PowerShell and run:

```powershell
rustup default stable
```

If Visual Studio Build Tools are missing, install them with:

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
```

During installation, select the `Desktop development with C++` workload.

If the build fails with:

```text
`icons/icon.ico` not found; required for generating a Windows Resource file during tauri-build
```

Prepare a square PNG icon, such as `app-icon.png`, and generate Tauri icons:

```powershell
npm run tauri icon app-icon.png
npm run tauri build
```

This generates the required Windows icon at:

```text
src-tauri\icons\icon.ico
```
