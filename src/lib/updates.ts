// Updates of the desktop app itself, through Tauri's updater. Only inside the desktop app:
// a browser window (npm run app) has nothing to update.

export type Update = { version: string; downloadAndInstall: () => Promise<void> };

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
type Tauri = {
  core?: { invoke: Invoke; Channel?: new () => { onmessage: unknown } };
  updater?: { check: () => Promise<Update | null> };
  process?: { relaunch: () => Promise<void> };
};

const tauri = (): Tauri | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as { __TAURI__?: Tauri }).__TAURI__;

export const canUpdate = () => Boolean(tauri()?.core);

/** A newer release, or null. Uses the updater's own script when the page has it, its commands when not. */
export async function checkForUpdate(): Promise<Update | null> {
  const t = tauri();
  if (t?.updater) return t.updater.check();
  if (!t?.core) return null;
  const found = (await t.core.invoke("plugin:updater|check", {})) as { rid: number; version: string } | null;
  if (!found) return null;
  const core = t.core;
  return {
    version: found.version,
    downloadAndInstall: async () => {
      const onEvent = core.Channel ? new core.Channel() : undefined;
      await core.invoke("plugin:updater|download_and_install", { rid: found.rid, onEvent });
    },
  };
}

/** Install it and start again on it (Windows closes the app for the installer, which opens it again). */
export async function installUpdate(update: Update) {
  await update.downloadAndInstall();
  const t = tauri();
  if (t?.process) await t.process.relaunch();
  else await t?.core?.invoke("plugin:process|restart").catch(() => {});
}
