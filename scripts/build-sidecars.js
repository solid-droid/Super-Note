import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function getTargetTriple() {
  try {
    const output = execSync('rustc -vV').toString();
    const hostLine = output.split('\n').find(line => line.startsWith('host:'));
    return hostLine ? hostLine.split(':')[1].trim() : null;
  } catch (e) {
    console.error('Failed to determine target triple via rustc. Ensure Rust is installed.');
    process.exit(1);
  }
}

function cleanupExternalBins() {
  // Clean up old compiled sidecars before building new ones
  console.log('Cleaning up old sidecar binaries...');
  
  const bunDir = path.join(rootDir, 'Sidecar', 'src-bun');
  const pythonDir = path.join(rootDir, 'Sidecar', 'src-python');
  
  // Remove built executables in src directories
  try {
    const bunBinary = path.join(bunDir, 'bun-sidecar');
    const pythonBinary = path.join(pythonDir, 'python-sidecar');
    const pythonDist = path.join(pythonDir, 'dist');
    const pythonBuild = path.join(pythonDir, 'build');
    
    [bunBinary, pythonBinary, pythonDist, pythonBuild].forEach(item => {
      if (fs.existsSync(item)) {
        console.log(`  Removing ${item}`);
        if (fs.statSync(item).isDirectory()) {
          fs.rmSync(item, { recursive: true, force: true });
        } else {
          fs.unlinkSync(item);
        }
      }
    });
    
    // Also remove old platform-specific binaries
    const files = fs.readdirSync(bunDir);
    files.forEach(file => {
      if (file.match(/^bun-sidecar-.*/) && file !== 'bun-sidecar') {
        const filePath = path.join(bunDir, file);
        console.log(`  Removing ${filePath}`);
        fs.unlinkSync(filePath);
      }
    });
    
    const pythonFiles = fs.readdirSync(pythonDir);
    pythonFiles.forEach(file => {
      if (file.match(/^python-sidecar-.*/) && file !== 'python-sidecar') {
        const filePath = path.join(pythonDir, file);
        console.log(`  Removing ${filePath}`);
        fs.unlinkSync(filePath);
      }
    });
    
    console.log('Cleanup completed');
  } catch (e) {
    console.warn('Failed to cleanup old binaries:', e.message);
  }
}

const triple = getTargetTriple();
const isWindows = process.platform === 'win32';
const ext = isWindows ? '.exe' : '';

console.log(`Target Triple: ${triple}`);
console.log(`Platform: ${process.platform}`);

// Clean up before building
cleanupExternalBins();

// 1. Build Bun Sidecar
const bunDir = path.join(rootDir, 'Sidecar', 'src-bun');
console.log('\nBuilding Bun sidecar...');
try {
  execSync('bun install', { cwd: bunDir, stdio: 'inherit' });
  execSync(`bun build --compile ./index.ts --outfile ./bun-sidecar`, { cwd: bunDir, stdio: 'inherit' });
  
  const src = path.join(bunDir, `bun-sidecar${ext}`);
  const dst = path.join(bunDir, `bun-sidecar-${triple}${ext}`);
  
  if (fs.existsSync(dst)) fs.unlinkSync(dst);
  fs.renameSync(src, dst);
  console.log(`Bun sidecar built: ${dst}`);
} catch (e) {
  console.warn('Skipping Bun sidecar build (Bun might not be installed).');
}

// 2. Build Python Sidecar
const pythonDir = path.join(rootDir, 'Sidecar', 'src-python');
console.log('\nBuilding Python sidecar...');
try {
  // Using pyinstaller
  execSync(`pip install pyinstaller`, { stdio: 'inherit' });
  execSync(`pyinstaller --onefile ./main.py --name python-sidecar`, { cwd: pythonDir, stdio: 'inherit' });
  
  const src = path.join(pythonDir, 'dist', `python-sidecar${ext}`);
  const dst = path.join(pythonDir, `python-sidecar-${triple}${ext}`);
  
  if (fs.existsSync(dst)) fs.unlinkSync(dst);
  fs.renameSync(src, dst);
  console.log(`Python sidecar built: ${dst}`);
} catch (e) {
  console.warn('Skipping Python sidecar build (Python or PyInstaller might not be available).');
}

console.log('\nSidecar build completed');

