#!/usr/bin/env node
/**
 * Build configuration helper for Tauri
 * Prepares the correct tauri.conf.json based on the target platform
 * Removes externalBin for non-desktop builds (Android, Web, etc.)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const configPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');

function getTargetPlatform() {
  // Check for TAURI_PLATFORM environment variable first
  if (process.env.TAURI_PLATFORM) {
    return process.env.TAURI_PLATFORM;
  }
  
  // Check for cargo target
  if (process.env.CARGO_CFG_TARGET_OS) {
    const os = process.env.CARGO_CFG_TARGET_OS;
    if (os.includes('android')) return 'android';
    if (os.includes('ios')) return 'ios';
    return 'desktop';
  }
  
  // Fallback to current platform
  const platform = process.platform;
  if (platform === 'win32') return 'desktop';
  if (platform === 'darwin') return 'desktop';
  if (platform === 'linux') return 'desktop';
  
  return 'desktop'; // Default to desktop
}

function prepareConfig(platform) {
  console.log(`Preparing build config for platform: ${platform}`);
  
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    // Backup original config
    const backupPath = configPath + '.backup';
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, JSON.stringify(config, null, 2));
    }
    
    // For non-desktop builds, remove externalBin
    if (platform !== 'desktop') {
      console.log(`Removing externalBin for ${platform} platform...`);
      if (config.bundle && config.bundle.externalBin) {
        delete config.bundle.externalBin;
      }
    } else {
      console.log(`Including externalBin for desktop platform...`);
      // Restore externalBin from backup if needed
      if (!config.bundle.externalBin) {
        const backupConfig = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
        if (backupConfig.bundle && backupConfig.bundle.externalBin) {
          config.bundle.externalBin = backupConfig.bundle.externalBin;
        }
      }
    }
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Config prepared successfully');
  } catch (err) {
    console.error('Failed to prepare config:', err);
    process.exit(1);
  }
}

const platform = getTargetPlatform();
prepareConfig(platform);
