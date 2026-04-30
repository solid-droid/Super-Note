# Sidecar Build Configuration Documentation

## Overview

This document explains the changes made to ensure sidecars are properly bundled only for desktop platforms (Windows, macOS, Linux) and not for Android or web builds.

## Changes Made

### 1. **Build Configuration Script** (`scripts/build-config.js`)
- Detects the target platform during build time
- Automatically removes `externalBin` from `tauri.conf.json` for non-desktop builds
- Preserves `externalBin` for desktop platforms
- Creates a backup of the original configuration

**Usage:**
```bash
npm run build:config
```

### 2. **Updated Build Process** (`build.rs`)
- Added platform detection in the Rust build script
- Sets environment variable `TAURI_DESKTOP_BUILD` for conditional compilation
- Detects Windows, macOS, and Linux as desktop platforms

### 3. **Enhanced Sidecar Build Script** (`scripts/build-sidecars.js`)
- Now cleans up old sidecar binaries before building new ones
- Removes platform-specific executables from previous builds
- Cleans up temporary directories (dist, build) used during compilation
- Logs cleanup operations for visibility

**Key Features:**
- Removes old binaries to prevent stale files from being bundled
- Cleans `dist` and `build` directories created during compilation
- Removes previous platform-specific builds

### 4. **UI Platform Checks** (`src/main.ts`)
- Added `isDesktopPlatform()` function to detect platform at runtime
- Added `isSidecarSupported()` function to check if sidecar functionality is available
- Sidecar buttons are automatically disabled on non-desktop platforms
- User-friendly error messages for unsupported platforms
- Improved error handling with helpful feedback

**New Capabilities:**
- Detects Windows, macOS, Linux as desktop platforms
- Shows informational message on unsupported platforms
- Disables sidecar UI elements on Android/Web/iOS
- Returns clear error messages when sidecar operations fail

### 5. **Updated Build Scripts** (`package.json`)
- Added `build:config` script that runs before sidecar compilation
- Updated `dev` command: `build:config → build:sidecars → vite`
- Updated `build` command: `build:config → build:sidecars → tsc → vite build`

## Build Flow

### For Desktop Builds (Windows, macOS, Linux):
```
npm run build
  ├─ npm run build:config
  │  └─ Restores externalBin in tauri.conf.json
  ├─ npm run build:sidecars
  │  ├─ Cleans up old binaries
  │  ├─ Builds Bun sidecar
  │  └─ Builds Python sidecar
  ├─ tsc (TypeScript compilation)
  └─ vite build (Frontend bundling)
```

### For Android/Web Builds:
```
npm run build
  ├─ npm run build:config
  │  └─ Removes externalBin from tauri.conf.json
  ├─ npm run build:sidecars
  │  └─ Skips sidecar build (no bundling)
  ├─ tsc (TypeScript compilation)
  └─ vite build (Frontend bundling)
```

## Platform Support Matrix

| Platform | Sidecar Support | Bundle externalBin | UI Status |
|----------|-----------------|------------------|-----------|
| Windows  | ✅ Yes          | ✅ Yes           | Enabled   |
| macOS    | ✅ Yes          | ✅ Yes           | Enabled   |
| Linux    | ✅ Yes          | ✅ Yes           | Enabled   |
| Android  | ❌ No           | ❌ No            | Disabled  |
| iOS      | ❌ No           | ❌ No            | Disabled  |
| Web      | ❌ No           | ❌ No            | Disabled  |

## Error Handling

The application now provides clear error messages for common scenarios:

1. **Platform not supported:**
   ```
   Error: Sidecars are not supported on this platform. 
   Sidecars are only available on desktop (Windows, macOS, Linux).
   ```

2. **Sidecar functionality unavailable:**
   ```
   Error: Sidecar functionality is not available in this build.
   ```

3. **Sidecar binary not found:**
   ```
   Failed to run sidecar: [specific error]
   Note: Make sure the sidecar binary is properly bundled for this platform.
   ```

## Files Modified

- `src-tauri/build.rs` - Platform detection for build time
- `src-tauri/tauri.conf.json` - Configuration with externalBin (managed by build-config.js)
- `src/main.ts` - Platform checks and improved error handling
- `scripts/build-sidecars.js` - Cleanup before bundling
- `scripts/build-config.js` - NEW: Platform-specific configuration
- `package.json` - Updated build scripts

## Testing

### Test on Desktop (Windows/macOS/Linux):
```bash
npm run dev
# Sidecar buttons should be enabled
# Click on "Run Bun" or "Run Python" should work
```

### Test Platform Detection:
Open browser console to check:
```javascript
// Check if platform detection is working
await isDesktopPlatform() // Should return true on desktop
```

### Test Configuration:
After running build:config, check:
```bash
cat src-tauri/tauri.conf.json | grep -A5 externalBin
```

## Troubleshooting

### Issue: Sidecar buttons are disabled on desktop
**Solution:** Ensure the platform detection is working correctly. Check the browser console for any errors.

### Issue: Old sidecar binaries being bundled
**Solution:** Run `npm run build:config` before building to clean up and prepare the configuration.

### Issue: externalBin not being removed for Android build
**Solution:** Ensure the `TAURI_PLATFORM` environment variable is set correctly or that `build-config.js` can detect the platform.

## Environment Variables

- `TAURI_PLATFORM` - Force a specific platform ('desktop', 'android', 'ios', 'web')
- `CARGO_CFG_TARGET_OS` - Automatically detected by Rust build system
- `TAURI_DESKTOP_BUILD` - Set by build.rs to indicate desktop build (true/false)

## Future Improvements

- Add support for platform-specific sidecar binaries
- Cache build configuration to speed up subsequent builds
- Add CI/CD integration for multi-platform builds
- Support for gradual rollout of features per platform
