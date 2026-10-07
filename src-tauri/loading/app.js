// SPDX-License-Identifier: AGPL-3.0-only - ucode, made and tested by om dixit. Additional terms: see NOTICE.
// The window buttons in the loading page's own title bar (the window has no system frame).
// Dragging and double-click-to-maximise come from `data-tauri-drag-region`.
(() => {
  const win = window.__TAURI__?.window?.getCurrentWindow?.();
  if (!win) return;

  const run = (action) => () => { win[action]().catch(() => {}); };
  document.getElementById("min").addEventListener("click", run("minimize"));
  document.getElementById("max").addEventListener("click", run("toggleMaximize"));
  document.getElementById("close").addEventListener("click", run("close"));

  const maxButton = document.getElementById("max");
  const showMaximized = async () => {
    const maximized = await win.isMaximized().catch(() => false);
    document.documentElement.classList.toggle("maximized", maximized);
    maxButton.setAttribute("aria-label", maximized ? "Restore" : "Maximise");
    maxButton.title = maximized ? "Restore" : "Maximise";
  };
  showMaximized();
  win.onResized(showMaximized).catch(() => {});
})();
