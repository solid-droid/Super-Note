use std::env;

fn main() {
    // Only include externalBin for desktop targets
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    
    // Desktop targets: windows, macos, linux
    let is_desktop = matches!(target_os.as_str(), "windows" | "macos" | "linux");
    
    println!("cargo:rustc-env=TAURI_DESKTOP_BUILD={}", if is_desktop { "true" } else { "false" });
    
    tauri_build::build()
}
