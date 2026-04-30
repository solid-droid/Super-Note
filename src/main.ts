import { invoke } from "@tauri-apps/api/core";
import { Command, Child } from "@tauri-apps/plugin-shell";
import { os } from "@tauri-apps/api";

let greetInputEl: HTMLInputElement | null;
let greetMsgEl: HTMLElement | null;
let outputEl: HTMLElement | null;
let killButtonEl: HTMLButtonElement | null;
let currentChild: Child | null = null;
let currentSidecarName: string | null = null;

// Platform detection for sidecar support
async function isDesktopPlatform(): Promise<boolean> {
  try {
    const platform = await os.platform();
    const type = await os.type();
    // Sidecars are only supported on desktop platforms: Windows, macOS, Linux
    return ['win32', 'darwin', 'linux'].includes(platform) && 
           !['android', 'ios', 'web'].includes(type);
  } catch (err) {
    console.warn('Failed to detect platform, assuming desktop:', err);
    return true; // Assume desktop by default
  }
}

// Check if sidecar functionality is available
function isSidecarSupported(): boolean {
  // Check if externalBin was bundled (this would be set by the build system)
  // For now, we assume sidecar is supported and let the Command.sidecar() call fail gracefully
  return true;
}

async function greet() {
  if (greetMsgEl && greetInputEl) {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    greetMsgEl.textContent = await invoke("greet", {
      name: greetInputEl.value,
    });
  }
}

async function runSidecar(name: string) {
  if (!outputEl) return;
  
  // Check if sidecar is supported on this platform
  const isDesktop = await isDesktopPlatform();
  if (!isDesktop) {
    outputEl.textContent = `Error: Sidecars are not supported on this platform. Sidecars are only available on desktop (Windows, macOS, Linux).`;
    return;
  }

  if (!isSidecarSupported()) {
    outputEl.textContent = `Error: Sidecar functionality is not available in this build.`;
    return;
  }

  outputEl.textContent = `Running ${name} sidecar...\n`;

  try {
    const sidecarPath = name === 'bun' 
      ? '../Sidecar/src-bun/bun-sidecar' 
      : '../Sidecar/src-python/python-sidecar';
    
    const command = Command.sidecar(sidecarPath);
    
    command.on('close', data => {
      outputEl!.textContent += `\n${name} sidecar closed with code ${data.code}`;
      currentChild = null;
      currentSidecarName = null;
      updateKillButtonState(false);
    });
    
    command.on('error', error => {
      outputEl!.textContent += `\nError: ${error}`;
      currentChild = null;
      currentSidecarName = null;
      updateKillButtonState(false);
    });
    
    command.stdout.on('data', line => {
      outputEl!.textContent += `\n[${name} stdout]: ${line}`;
    });
    
    command.stderr.on('data', line => {
      outputEl!.textContent += `\n[${name} stderr]: ${line}`;
    });

    const child = await command.spawn();
    currentChild = child;
    currentSidecarName = name;
    updateKillButtonState(true);
    outputEl.textContent += `\nSidecar spawned with PID: ${child.pid}`;
    
    // Optionally send some input
    await child.write("Hello from Frontend!\n");

  } catch (err) {
    outputEl.textContent += `\nFailed to run sidecar: ${err}`;
    outputEl.textContent += `\nNote: Make sure the sidecar binary is properly bundled for this platform.`;
    currentChild = null;
    currentSidecarName = null;
    updateKillButtonState(false);
  }
}

async function killSidecar() {
  if (!outputEl) return;
  if (!currentChild) {
    outputEl.textContent += `\nNo active sidecar to kill.`;
    return;
  }

  try {
    await currentChild.kill();
    outputEl.textContent += `\nKilled ${currentSidecarName ?? 'sidecar'} (PID: ${currentChild.pid}).`;
  } catch (err) {
    outputEl.textContent += `\nFailed to kill sidecar: ${err}`;
  } finally {
    currentChild = null;
    currentSidecarName = null;
    updateKillButtonState(false);
  }
}

function updateKillButtonState(enabled: boolean) {
  if (!killButtonEl) return;
  killButtonEl.disabled = !enabled;
}

window.addEventListener("DOMContentLoaded", async () => {
  greetInputEl = document.querySelector("#greet-input");
  greetMsgEl = document.querySelector("#greet-msg");
  outputEl = document.querySelector("#sidecar-output");
  killButtonEl = document.querySelector("#kill-sidecar");

  // Check if we're on a platform that supports sidecars
  const isDesktop = await isDesktopPlatform();
  if (!isDesktop && outputEl) {
    outputEl.innerHTML = '<div style="color: #ff9800; font-weight: bold;">ℹ Sidecars are only supported on desktop platforms (Windows, macOS, Linux)</div>';
  }

  // Disable sidecar buttons on non-desktop platforms
  const bunBtn = document.querySelector("#run-bun");
  const pythonBtn = document.querySelector("#run-python");
  if (!isDesktop) {
    if (bunBtn) (bunBtn as HTMLButtonElement).disabled = true;
    if (pythonBtn) (pythonBtn as HTMLButtonElement).disabled = true;
  }

  document.querySelector("#greet-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    greet();
  });

  bunBtn?.addEventListener("click", () => runSidecar('bun'));
  pythonBtn?.addEventListener("click", () => runSidecar('python'));
  document.querySelector("#kill-sidecar")?.addEventListener("click", () => killSidecar());
});
