# Project Scripts

## Setup Scripts
**When to use:** First-time setup or when dependencies are missing.
```powershell
# Windows
.\scripts\setup.ps1
```
```bash
# macOS / Linux
./scripts/setup.sh
```
Installs: Rust, Bun, Python, PyInstaller, and Node dependencies.

---

## Sidecar Builder
**When to use:** Before running the app or when sidecar code changes.
```bash
node scripts/build-sidecars.js
```
- Compiles Bun (`Sidecar/src-bun`) and Python (`Sidecar/src-python`).
- Renames binaries to match the current target triple (e.g., `-x86_64-pc-windows-msvc`).
- Automatically called during `npm run dev` and `npm run build`.

---

## Updater Key Generator
**When to use:** To set up or rotate app signing keys for the Tauri Updater.
```bash
# Default password: nikhil1997
node scripts/generate-updater-keys.js [password]
```
- Generates Minisign key pair.
- Saves private key to `scripts/secrets/TAURI_UPDATER_PRIVATE_KEY.txt`.
- Updates `pubkey` in `src-tauri/tauri.conf.json`.

---

## Secret Generator (CI)
**When to use:** Preparing for GitHub Actions deployment.
```powershell
.\scripts\createSecrets.ps1
```
- Generates Android upload keystores.
- Creates RSA keys for Tauri signing.
- Saves all outputs to `scripts/secrets/` for manual upload to GitHub Secrets.

---

## Secrets Directory
Files in `scripts/secrets/` are **sensitive** and excluded from Git.
- `TAURI_UPDATER_PRIVATE_KEY.txt`: Used for signing update packages.
- `ANDROID_RELEASE_KEY.txt`: Key alias for Android builds.
- `TAURI_SIGNING_PRIVATE_KEY.pem`: Legacy RSA signing key for Tauri v1 (if needed).
