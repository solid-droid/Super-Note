import { invoke } from "@tauri-apps/api/core";
import { Command, Child } from "@tauri-apps/plugin-shell";

let greetInputEl: HTMLInputElement | null;
let greetMsgEl: HTMLElement | null;
let outputEl: HTMLElement | null;
let killButtonEl: HTMLButtonElement | null;
let currentChild: Child | null = null;
let currentSidecarName: string | null = null;

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

window.addEventListener("DOMContentLoaded", () => {
  greetInputEl = document.querySelector("#greet-input");
  greetMsgEl = document.querySelector("#greet-msg");
  outputEl = document.querySelector("#sidecar-output");
  killButtonEl = document.querySelector("#kill-sidecar");

  document.querySelector("#greet-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    greet();
  });

  document.querySelector("#run-bun")?.addEventListener("click", () => runSidecar('bun'));
  document.querySelector("#run-python")?.addEventListener("click", () => runSidecar('python'));
  document.querySelector("#kill-sidecar")?.addEventListener("click", () => killSidecar());
});
