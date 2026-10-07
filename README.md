# ucode desktop

**ucode in its own window** — the free AI coding agent, without the terminal.
Say what you want built, watch it being made, click around in it, undo anything.

*made and tested by om dixit*

## What it does

- **Chat with ucode** — type, speak (mic), or drop in a picture or file. Build mode makes the changes; Plan mode only plans.
- **Watch it work** — every step live, and a question before anything risky: *Allow once*, *Always allow*, or *Don't allow*.
- **See your app** — a live preview beside the chat, in computer or phone size.
- **Code and changes** — read every file, see what changed in green and red, and **Undo** a turn or all of them.
- **Share online** — one click puts the app on the internet and gives you a link (free Vercel token).
- **Projects and chats** — open any folder, keep its chats together, rename or delete them, search everything with Ctrl+K.
- **Your choice of free AI** — Google Gemini or OpenRouter (NVIDIA Nemotron, Gemma). No paid models.
- **Settings in plain words** — keys, models, permissions, project notes, skills, add-ons, and a check that everything works.

## Install

1. Install [Node.js](https://nodejs.org) (the LTS button). ucode itself comes with the app.
2. Download from [Releases](https://github.com/sppideey/ucode-desktop/releases):
   - **Windows:** `ucode_x.y.z_x64-setup.exe` — run it. Windows may warn because the app is new and unsigned: **More info → Run anyway**.
   - **Mac:** `ucode_x.y.z_universal.dmg` — open it and drag ucode into Applications. The first time, **right-click ucode → Open → Open** (the app is not signed by Apple yet).
3. Open ucode. In **Settings → Keys**, add a free key: [Google](https://aistudio.google.com/apikey) or [OpenRouter](https://openrouter.ai/keys).
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
