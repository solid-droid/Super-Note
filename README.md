# Super Note (Tauri + Sidecars)

A Tauri application with Bun and Python sidecars.

## Prerequisites

- **Bun**: For the Bun sidecar.
- **Python & PyInstaller**: For the Python sidecar (`pip install pyinstaller`).
- **Rust**: For building the Tauri app.

## Getting Started

1. **Setup all prerequisites**:
   - **Windows (PowerShell)**:
     ```powershell
     .\scripts\setup.ps1
     ```
   - **macOS/Linux (Bash)**:
     ```bash
     chmod +x scripts/setup.sh && ./scripts/setup.sh
     ```

2. **Run in development**:
   ```bash
   npm run tauri dev
   ```
   *Note: This automatically builds the sidecars using `scripts/build-sidecars.js` before starting the app.*

## Sidecar Details

- **Bun**: Located in `Sidecar/src-bun/`. Built using `bun build --compile`.
- **Python**: Located in `Sidecar/src-python/`. Built using `pyinstaller`.

Binaries are automatically suffixed with your system's target triple (e.g., `-x86_64-pc-windows-msvc`) so Tauri can execute them.

## Scripts

- `npm run build:sidecars`: Manually rebuild sidecar binaries.
- `npm run tauri build`: Build the production-ready application.
