# ucode desktop

**ucode in its own window** — the free AI coding agent, without the terminal.
Say what you want built, watch it being made, click around in it, undo anything.

*made and tested by om dixit*

## What it does

- **Chat with ucode** — type, speak (mic), or drop in a picture or file. Build mode makes the changes; Plan mode only plans.
- **Watch it work** — every step live, in plain words, and a question before anything risky: *Allow once*, *Always allow*, or *Don't allow*.
- **See your app** — a live preview beside the chat, in computer or phone size.
- **Code and changes** — read every file, see what changed in green and red, and **Undo** a turn or all of them.
- **Share online** — one click, or just say it: "make me a quiz app and put it online" builds it and gives you the link (free Vercel token).
- **Your chats** — every chat in the sidebar, each with Rename and Delete; search everything with Ctrl+K; work in any folder you open.
- **Your choice of free AI** — Google Gemini, OpenRouter (every free model there) or NVIDIA (Nemotron and more). One provider at a time, with a default model for each. No paid models.
- **Settings in plain words** — keys, models, permissions, project notes, skills, add-ons, and a check that everything works.
- **Updates itself** — a new version installs on its own and the app opens again on it.

## Install

1. Install [Node.js](https://nodejs.org) (the LTS button). ucode itself comes with the app.
2. Download from [Releases](https://github.com/sppideey/ucode-desktop/releases):
   - **Windows:** `ucode_x.y.z_x64-setup.exe` — run it. Windows may warn because the app is new and unsigned: **More info → Run anyway**.
   - **Mac:** `ucode_x.y.z_universal.dmg` — open it and drag ucode into Applications. The first time, **right-click ucode → Open → Open** (the app is not signed by Apple yet).
3. Open ucode. In **Settings → Models**, add a free key: [Google](https://aistudio.google.com/apikey), [OpenRouter](https://openrouter.ai/keys) or [NVIDIA](https://build.nvidia.com/settings/api-keys).
   To share apps online, add a free Vercel token there too — the Keys page shows the steps.

The terminal `ucode` is a separate program and is not changed by this app.

## How it works

The app is a small native window (Tauri). It starts its own server (`server/main.mjs`, with the copy
of ucode that comes with the app) on this computer only (127.0.0.1, a random port, a one-time token),
and shows its page. Nothing is sent anywhere except to the AI provider you choose.

## Build it yourself

```bash
npm install
npm run build            # the page (static export in out/)
npm run engine           # the copy of ucode the app carries (engine/)
npm run app              # try it in a browser window, or:
npx tauri build          # the window and its installer (needs Rust)
```

Pushing a tag `v*` builds the Windows and Mac installers on GitHub and publishes them as a release.

## Licence

GNU AGPL v3 with additional terms — keep the credit "made and tested by om dixit" ([NOTICE](NOTICE)).
Documentation: CC BY 4.0 ([LICENSE-DOCS](LICENSE-DOCS)). See [CONTRIBUTING.md](CONTRIBUTING.md).
