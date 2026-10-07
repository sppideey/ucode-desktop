// SPDX-License-Identifier: AGPL-3.0-only - ucode desktop, made and tested by om dixit. Additional terms: see NOTICE.
/**
 * webui.js — the agent's interface when it runs inside the desktop app.
 *
 * It carries the same method names as screen.js and plain.js, so the loop
 * never knows the difference, but instead of drawing anything it hands each
 * thing that happens to the app window as an event: a step, a line of the
 * reply, a question that needs an answer. Colours are terminal codes, so they
 * are stripped; the window has its own.
 */

import { randomUUID } from 'node:crypto';
import { bare, asLabel, asNarrationLine, tidyReply, trimAnswer } from './ucode.mjs';

const plain = (s) => bare(String(s ?? '')).replace(/\r/g, '');

export class WebUI {
  /** emit(event) sends one event to the window; answers come back through answer(). */
  constructor({ cwd, emit }) {
    this.cwd = cwd;
    this.emit = emit;
    this.mode = 'build';
    this.live = true;          // the loop streams the reply here as it is written
    this.attachments = [];
    this.waiting = new Map();  // question id -> resolve
    this.capture = null;       // an array while a settings command collects its output
    this.streamBuf = '';
  }

  /** Output that belongs to a settings page, while one is asking; the chat otherwise. */
  out(event) {
    if (this.capture) {
      if (event.text) this.capture.push(event.text);
      for (const line of event.lines ?? []) this.capture.push(line);
      if (event.title && !this.capture.title) this.capture.title = event.title;
      return;
    }
    this.emit(event);
  }

  width() { return 100; }
  write(text = '') { const t = plain(text); if (t.trim()) this.out({ type: 'line', text: t }); }
  blank() {}
  note(text) { const t = plain(text).trim(); if (t) this.out({ type: 'note', text: t }); }
  flash(text) { this.note(text); }
  clearScreen() {}
  header() {}
  setFacts() {}
  welcoming() { return false; }
  render() {}

  toolCall(label) { this.emit({ type: 'step', text: asLabel(plain(label)) }); }
  toolResult(summary) { this.emit({ type: 'stepDone', text: plain(summary), ok: true }); }
  toolFailed(summary) { this.emit({ type: 'stepDone', text: plain(summary), ok: false }); }
  diff() {}
  diffStat(d) { this.emit({ type: 'diffStat', ...d }); }
  runStat(text) { this.emit({ type: 'runStat', text: plain(text) }); }
  commandOutput(lines) { this.out({ type: 'lines', lines: lines.map(plain) }); }
  plan(items) { this.emit({ type: 'plan', items }); }
  narrate(text) { const t = asLabel(plain(text)); if (t) this.emit({ type: 'narrate', text: t }); }
  progress(lines) { const last = plain(lines.at(-1)).trim(); if (last) this.updateSpinner(last); }
  userMessage() {}

  assistant(text, { replay = false, closing = false } = {}) {
    const body = replay ? String(text) : closing ? trimAnswer(tidyReply(String(text))) : tidyReply(String(text));
    if (body.trim()) this.emit({ type: 'reply', text: body });
  }

  streamBegin() { this.streamBuf = ''; this.emit({ type: 'streamBegin' }); }
  streamDelta(delta) { this.streamBuf += delta; this.emit({ type: 'delta', text: delta }); }
  streamEnd({ asNarration = false, closing = false } = {}) {
    const text = this.streamBuf;
    this.streamBuf = '';
    // Said beside a tool call it is commentary: one line in the steps, not an answer.
    if (asNarration) {
      this.emit({ type: 'streamDrop' });
      const line = asNarrationLine(text);
      if (line) this.narrate(line);
    } else this.emit({ type: 'streamEnd', text: closing ? trimAnswer(tidyReply(text)) : tidyReply(text) });
    return text;
  }
  thinkingDelta() {}
  thinkingEnd() {}

  startSpinner(text = 'thinking') { this.spinner = asLabel(plain(text)); this.emit({ type: 'spinner', text: this.spinner }); }
  updateSpinner(text) { this.startSpinner(text); }
  stopSpinner() { if (this.spinner) { this.spinner = null; this.emit({ type: 'spinner', text: null }); } }
  stopTimer() {}

  turnStart() { this.started = Date.now(); this.emit({ type: 'turnStart' }); }
  step() {}
  turnEnd({ ok = true } = {}) { this.emit({ type: 'turnEnd', ok, ms: Date.now() - (this.started ?? Date.now()) }); }

  /** Put a question to the window and wait for the answer. */
  question(kind, data) {
    const id = randomUUID();
    this.emit({ type: 'question', id, kind, ...data });
    return new Promise((resolve) => this.waiting.set(id, resolve));
  }

  /** The window answered. Returns whether the question was this one's. */
  answer(id, value) {
    const resolve = this.waiting.get(id);
    if (!resolve) return false;
    this.waiting.delete(id);
    this.emit({ type: 'answered', id });
    resolve(value);
    return true;
  }

  /** Stopped: every open question is a no, and nothing runs that nobody approved. */
  dropQuestions() {
    for (const [id, resolve] of this.waiting) {
      this.emit({ type: 'answered', id });
      resolve(null);
    }
    this.waiting.clear();
  }

  async confirm({ action, detail, risk, always }) {
    const said = await this.question('confirm', { action: plain(action), detail: plain(detail), risk: risk ?? null, always: always ?? null });
    return said === 'always' && always ? 'always' : said === true;
  }

  pick(items, { title = null } = {}) {
    return this.question('pick', { title, items: items.map((i) => plain(typeof i === 'string' ? i : i.label).trim()) })
      .then((i) => (Number.isInteger(i) && i >= 0 && i < items.length ? i : null));
  }

  choose(prompt, items) {
    return this.pick(items, { title: plain(prompt) });
  }

  panel(title, lines) {
    this.out({ type: 'panel', title: plain(title), lines: lines.map(plain) });
    return Promise.resolve();
  }

  error(err) {
    const known = err && typeof err === 'object' && err.attempted;
    this.out({
      type: 'error',
      text: known ? `Failed while ${err.attempted}. ${err.failed}` : `Something broke inside ucode: ${err?.message ?? err}`,
      fix: known ? plain(err.fix ?? '') : 'That is a bug in ucode rather than in your project.',
      kind: known ? err.kind : 'bug',
    });
  }

  addAttachment(file) { this.attachments.push(file); }
  takeAttachments() { const all = this.attachments; this.attachments = []; return all; }

  /** A finished page or a running server: shown in the app's preview panel. */
  showPreview(target) {
    this.emit({ type: 'preview', target: String(target) });
    return true;
  }

  close() {}
}
