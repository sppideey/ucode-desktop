// SPDX-License-Identifier: AGPL-3.0-only - ucode desktop, made and tested by om dixit. Additional terms: see NOTICE.

//! ucode desktop: a native window around the app's own local server
//! (server/main.mjs, bundled with the app, on top of the installed ucode). It shows a loading page, starts the server,
//! opens the address the server prints, and stops the server on close.

// No console window behind the app in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::{mpsc, Mutex, PoisonError};
use std::time::Duration;

use tauri::webview::{PermissionKind, PermissionResponse};
use tauri::{AppHandle, Manager, RunEvent, Url, Webview, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// The line the server prints once it is up, and the one it prints when it cannot start.
const URL_PREFIX: &str = "UCODE_APP_URL ";
const ERROR_PREFIX: &str = "UCODE_APP_ERROR ";
/// Windows: start the server without a console window.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// The server's port once known. The window only shows pages from it (and the loading page).
static SERVER_PORT: AtomicU16 = AtomicU16::new(0);

/// The running server, and whether the app is closing (then nothing new may start).
#[derive(Default)]
struct Server(Mutex<Running>);

#[derive(Default)]
struct Running {
    child: Option<Child>,
    closing: bool,
}

impl Server {
    /// Remembers the server so it can be stopped later. False (and stops it) if the app is closing.
    fn keep(&self, child: Child) -> bool {
        let mut running = self.0.lock().unwrap_or_else(PoisonError::into_inner);
        if running.closing {
            drop(running);
            kill_tree(child);
            return false;
        }
        running.child = Some(child);
        true
    }

    /// Stops the server, if one is running. `closing` also stops any later start.
    fn stop(&self, closing: bool) {
        let child = {
            let mut running = self.0.lock().unwrap_or_else(PoisonError::into_inner);
            running.closing |= closing;
            running.child.take()
        };
        if let Some(child) = child {
            kill_tree(child);
        }
    }
}

fn main() {
    let app = tauri::Builder::default()
        .manage(Server::default())
        .setup(|app| {
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("ucode")
                .inner_size(1280.0, 820.0)
                .min_inner_size(900.0, 600.0)
                .center()
                // No system frame: the pages draw their own title bar and window buttons.
                // The shadow keeps the drop shadow and thin border on Windows 10/11.
                .decorations(false)
                .shadow(true)
                .resizable(true)
                .on_navigation(allowed)
                .on_permission_request(permission)
                .build()?;
            let handle = app.handle().clone();
            let home = app.path().home_dir().ok();
            std::thread::spawn(move || open_server(&handle, &window, home));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("ucode could not open its window");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            handle.state::<Server>().stop(true);
        }
    });
}

/// Starts the server and shows it in the window, or the help on the loading page if it cannot start.
fn open_server(handle: &AppHandle, window: &WebviewWindow, home: Option<PathBuf>) {
    let server = handle.state::<Server>();
    match start(&server, handle, home.as_deref()) {
        Some(url) => {
            SERVER_PORT.store(url.port().unwrap_or(0), Ordering::SeqCst);
            let _ = window.navigate(url);
        }
        None => {
            let _ = window.eval("document.documentElement.classList.add('failed')");
        }
    }
}

/// `UCODE_APP_CMD` if set (for testing), else the server bundled with the app, run by the installed Node.
fn start(server: &Server, handle: &AppHandle, home: Option<&Path>) -> Option<Url> {
    if let Ok(cmdline) = std::env::var("UCODE_APP_CMD") {
        return attempt(server, &cmdline, home, Duration::from_secs(120));
    }
    let script = handle.path().resource_dir().ok()?.join("server").join("main.mjs");
    let script = script.to_string_lossy();
    // Windows hands resource paths over as \\?\C:\..., which node cannot open.
    let script = script.strip_prefix(r"\\?\").unwrap_or(&script);
    attempt(server, &format!("node \"{script}\" --serve"), home, Duration::from_secs(120))
}

/// Runs one command line and waits up to `wait` for the address it prints.
/// Stops what it started if no address comes (it exits, hangs, or prints a bad one).
fn attempt(server: &Server, cmdline: &str, home: Option<&Path>, wait: Duration) -> Option<Url> {
    let mut child = shell(cmdline, home).spawn().ok()?;
    let Some(stdout) = child.stdout.take() else {
        kill_tree(child);
        return None;
    };
    if !server.keep(child) {
        return None;
    }
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut lines = BufReader::new(stdout).split(b'\n').map_while(Result::ok);
        for line in lines.by_ref() {
            let line = String::from_utf8_lossy(&line);
            if let Some(url) = line.trim_end().strip_prefix(URL_PREFIX) {
                let _ = tx.send(url.trim().to_owned());
                break;
            }
            // ucode is missing or too old: give up at once (the loading page explains).
            if line.starts_with(ERROR_PREFIX) {
                let _ = tx.send(String::new());
                break;
            }
        }
        // Keep reading, so the server never writes into a closed pipe.
        lines.for_each(drop);
    });
    let url = rx.recv_timeout(wait).ok().and_then(|text| local_url(&text));
    if url.is_none() {
        server.stop(false);
    }
    url
}

/// The command line run through the system shell, with stdout piped and no window.
fn shell(cmdline: &str, home: Option<&Path>) -> Command {
    #[cfg(windows)]
    let mut cmd = {
        use std::os::windows::process::CommandExt;
        let mut cmd = Command::new("cmd");
        // /S /C "...": cmd runs the text inside the outer quotes exactly as written.
        cmd.raw_arg(format!("/D /S /C \"{cmdline}\""))
            .creation_flags(CREATE_NO_WINDOW);
        cmd
    };
    #[cfg(not(windows))]
    let mut cmd = {
        use std::os::unix::process::CommandExt;
        // A login shell finds ucode and npx even when the app starts from a dock or menu.
        // Its own process group lets `kill_tree` stop everything it starts.
        let mut cmd = Command::new(std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into()));
        cmd.arg("-lc").arg(cmdline).process_group(0);
        cmd
    };
    cmd.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null());
    if let Some(home) = home {
        cmd.current_dir(home);
    }
    cmd
}

/// Stops the server and everything it started.
fn kill_tree(mut child: Child) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = Command::new("taskkill")
            .args(["/PID", &child.id().to_string(), "/T", "/F"])
            .creation_flags(CREATE_NO_WINDOW)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("kill")
            .args(["-TERM", "--", &format!("-{}", child.id())])
            .status();
    }
    let _ = child.kill();
    let _ = child.wait();
}

/// The server's address, only if it is a plain http page on this computer.
fn local_url(text: &str) -> Option<Url> {
    let url = Url::parse(text).ok()?;
    let local = url.scheme() == "http" && url.host_str() == Some("127.0.0.1") && url.port().is_some();
    local.then_some(url)
}

/// A page of the running server.
fn is_server(url: &Url) -> bool {
    let port = SERVER_PORT.load(Ordering::SeqCst);
    port != 0 && url.scheme() == "http" && url.host_str() == Some("127.0.0.1") && url.port() == Some(port)
}

/// Pages the window may show: the loading page, and the server's own pages.
fn allowed(url: &Url) -> bool {
    url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost") || is_server(url)
}

/// The server's page may use the microphone (voice input) without asking.
/// Everything else keeps the webview's usual behaviour.
fn permission(webview: Webview, kind: PermissionKind) -> PermissionResponse {
    let from_server = webview.url().is_ok_and(|url| is_server(&url));
    if matches!(kind, PermissionKind::Microphone) && from_server {
        PermissionResponse::Allow
    } else {
        PermissionResponse::Default
    }
}
