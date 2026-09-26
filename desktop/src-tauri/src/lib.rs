//! A thin desktop window around the Expo web export.
//!
//! The web app has no Tauri-specific code: everything the shell adds lives
//! here, in Rust, so the web bundle stays identical to what babyvom.it serves.
//!
//! - External links (`<a target="_blank">`, `window.open`, `Linking.openURL`,
//!   mailto:) open in the system browser or mail app. WKWebView silently drops
//!   new-window requests otherwise.
//! - `cocktailapp://…` links (the same scheme the native app registers) are
//!   routed into the window, so `cocktailapp://auth/callback?token_hash=…`
//!   lands on the web app's `/auth/callback` exactly like it does on iOS.

use std::sync::Mutex;

use tauri::{
  webview::NewWindowResponse, AppHandle, Manager, Url, WebviewWindow,
  WebviewWindowBuilder,
};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;

const MAIN: &str = "main";
const SCHEME: &str = "cocktailapp";

/// The last deep link routed into the window. macOS can report a launch link
/// both from `get_current` and as an open-url event.
struct LastDeepLink(Mutex<Option<String>>);

/// Whether a URL belongs to the bundled app (or the dev server in debug).
fn is_app_url(url: &Url) -> bool {
  match url.scheme() {
    "tauri" | "about" | "blob" => true,
    "http" | "https" => match url.host_str() {
      // Windows serves the bundle from http(s)://tauri.localhost.
      Some("tauri.localhost") => true,
      Some("localhost" | "127.0.0.1") => cfg!(debug_assertions),
      _ => false,
    },
    _ => false,
  }
}

/// Hands a URL to the OS if it's one we're willing to open outside the app.
fn open_externally(app: &AppHandle, url: &Url) {
  if matches!(url.scheme(), "http" | "https" | "mailto" | "tel") {
    if let Err(err) = app.opener().open_url(url.as_str(), None::<&str>) {
      eprintln!("could not open {url}: {err}");
    }
  } else {
    eprintln!("blocked navigation to {url}");
  }
}

/// `cocktailapp://auth/callback?x=1` → `<app origin>/auth/callback?x=1`.
fn deep_link_target(app_url: &Url, link: &Url) -> Option<Url> {
  if link.scheme() != SCHEME {
    return None;
  }
  let host = link.host_str().unwrap_or_default();
  let path = if host.is_empty() {
    link.path().to_string()
  } else {
    format!("/{host}{}", link.path())
  };
  let mut target = app_url.clone();
  target.set_path(&path);
  target.set_query(link.query());
  target.set_fragment(link.fragment());
  Some(target)
}

fn show(window: &WebviewWindow) {
  let _ = window.unminimize();
  let _ = window.show();
  let _ = window.set_focus();
}

fn route_deep_link(app: &AppHandle, link: &Url) {
  let Some(window) = app.get_webview_window(MAIN) else {
    return;
  };
  let Ok(current) = window.url() else {
    return;
  };
  let Some(target) = deep_link_target(&current, link) else {
    return;
  };
  let last = app.state::<LastDeepLink>();
  let mut last = last.0.lock().unwrap();
  if last.as_deref() == Some(link.as_str()) {
    show(&window);
    return;
  }
  *last = Some(link.to_string());
  if let Err(err) = window.navigate(target) {
    eprintln!("could not route {link}: {err}");
  }
  show(&window);
}

fn create_main_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
  let config = app
    .config()
    .app
    .windows
    .iter()
    .find(|w| w.label == MAIN)
    .expect("tauri.conf.json defines the main window")
    .clone();

  let nav_app = app.clone();
  let popup_app = app.clone();
  WebviewWindowBuilder::from_config(app, &config)?
    .title(&app.package_info().name)
    .on_navigation(move |url| {
      if is_app_url(url) {
        return true;
      }
      open_externally(&nav_app, url);
      false
    })
    .on_new_window(move |url, _features| {
      if is_app_url(&url) {
        // An in-app link asked for a new window: keep it in this one.
        if let Some(window) = popup_app.get_webview_window(MAIN) {
          let _ = window.navigate(url);
        }
      } else {
        open_externally(&popup_app, &url);
      }
      NewWindowResponse::Deny
    })
    .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default();

  #[cfg(desktop)]
  {
    builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
      if let Some(window) = app.get_webview_window(MAIN) {
        show(&window);
      }
    }));
  }

  builder
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_deep_link::init())
    .manage(LastDeepLink(Mutex::new(None)))
    .setup(|app| {
      create_main_window(app.handle())?;

      // Linux and Windows dev builds only know the scheme once registered at
      // runtime; macOS gets it from the bundle's Info.plist.
      #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
      app.deep_link().register_all()?;

      if let Ok(Some(urls)) = app.deep_link().get_current() {
        for url in &urls {
          route_deep_link(app.handle(), url);
        }
      }
      let handle = app.handle().clone();
      app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
          route_deep_link(&handle, &url);
        }
      });
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running the desktop app");
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn routes_scheme_links_onto_the_app_origin() {
    let app = Url::parse("tauri://localhost/cocktail/1").unwrap();
    let link = Url::parse("cocktailapp://auth/callback?token_hash=abc&type=magiclink").unwrap();
    assert_eq!(
      deep_link_target(&app, &link).unwrap().as_str(),
      "tauri://localhost/auth/callback?token_hash=abc&type=magiclink"
    );
    let root = Url::parse("cocktailapp:///v/some-bar").unwrap();
    assert_eq!(
      deep_link_target(&app, &root).unwrap().as_str(),
      "tauri://localhost/v/some-bar"
    );
    let other = Url::parse("https://babyvom.it/auth/callback").unwrap();
    assert!(deep_link_target(&app, &other).is_none());
  }

  #[test]
  fn keeps_only_app_urls_in_the_window() {
    assert!(is_app_url(&Url::parse("tauri://localhost/auth/login").unwrap()));
    assert!(is_app_url(&Url::parse("http://tauri.localhost/").unwrap()));
    assert!(!is_app_url(&Url::parse("https://babyvom.it/").unwrap()));
    assert!(!is_app_url(&Url::parse("mailto:hi@example.com").unwrap()));
    assert!(!is_app_url(&Url::parse("file:///etc/passwd").unwrap()));
  }
}
