use super::CmdResult;
use reqwest::Client;
use serde::Serialize;
use std::env;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

const ELECTRON_REPO: &str = "ckeiituk/outclash";

#[derive(Serialize, Clone)]
pub struct BridgeRelease {
    pub version: String,
    pub download_url: String,
    pub body: String,
}

#[derive(Serialize, Clone)]
pub struct BridgeProgress {
    downloaded: u64,
    total: u64,
}

/// Check if an Electron release is available
#[tauri::command]
pub async fn bridge_check() -> CmdResult<Option<BridgeRelease>> {
    let client = Client::builder()
        .user_agent("outclash-bridge")
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("https://api.github.com/repos/{}/releases/latest", ELECTRON_REPO);
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Ok(None);
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let version = json["tag_name"]
        .as_str()
        .unwrap_or("")
        .trim_start_matches('v')
        .to_string();

    if version.is_empty() {
        return Ok(None);
    }

    let body = json["body"].as_str().unwrap_or("").to_string();

    // Find the installer asset for current platform/arch
    let asset_name = get_installer_asset_name();
    let download_url = json["assets"]
        .as_array()
        .and_then(|assets| {
            assets.iter().find_map(|a| {
                let name = a["name"].as_str().unwrap_or("");
                if name == asset_name {
                    a["browser_download_url"].as_str().map(|s| s.to_string())
                } else {
                    None
                }
            })
        });

    match download_url {
        Some(url) => Ok(Some(BridgeRelease {
            version,
            download_url: url,
            body,
        })),
        None => Ok(None),
    }
}

/// Download the Electron installer and launch it
#[tauri::command]
pub async fn bridge_download(app: AppHandle, url: String) -> CmdResult<()> {
    let client = Client::builder()
        .user_agent("outclash-bridge")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;

    let total = resp.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    let temp_dir = env::temp_dir();
    let file_name = url.split('/').last().unwrap_or("OutClash-setup.exe");
    let file_path = temp_dir.join(file_name);

    let mut file = tokio::fs::File::create(&file_path)
        .await
        .map_err(|e| e.to_string())?;

    let mut stream = resp.bytes_stream();
    use futures_util::StreamExt;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        let _ = app.emit("bridge-progress", BridgeProgress { downloaded, total });
    }

    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);

    // Launch the installer
    launch_installer(&file_path)?;

    // Exit the app
    app.exit(0);

    Ok(())
}

fn get_installer_asset_name() -> String {
    let arch = if cfg!(target_arch = "x86_64") {
        "x64"
    } else if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "x64"
    };

    if cfg!(target_os = "windows") {
        format!("OutClash_{}-setup.exe", arch)
    } else if cfg!(target_os = "macos") {
        format!("OutClash_{}.pkg", arch)
    } else {
        format!("OutClash_{}.deb", arch)
    }
}

fn launch_installer(path: &PathBuf) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new(path)
            .spawn()
            .map_err(|e| format!("Failed to launch installer: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to launch installer: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        // Open file manager or package installer
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open installer: {}", e))?;
    }

    Ok(())
}
