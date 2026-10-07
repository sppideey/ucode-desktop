"use client";

import { Fragment, type ReactNode } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { post } from "@/lib/api";

/** Links open in the computer's own browser, never inside the app window. */
function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        post("open", { target: href.startsWith("file:") ? decodeURI(href.replace(/^file:\/\/\/?/, "")) : href })
          .catch(() => toast("ucode only opens web links and files in your projects"));
      }}
      className="break-words text-primary underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

/** **bold**, `code`, [links](url) and bare links in one line. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|(?:https?|file):\/\/[^\s)]+)/g;
  let at = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > at) out.push(text.slice(at, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={m.index} className="font-semibold">{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={m.index} className="rounded-[5px] bg-accent px-1 py-px font-mono text-[12px]">{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) {
      const [, label, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t) ?? [];
      out.push(<Link key={m.index} href={href}>{label}</Link>);
    } else out.push(<Link key={m.index} href={t}>{t}</Link>);
    at = m.index + t.length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

/** A fenced block: mono, scrolls sideways, with a copy button on hover. */
function Code({ code }: { code: string }) {
  return (
    <div className="group/code relative">
      <pre className="overflow-x-auto rounded-lg border bg-muted/70 px-3 py-2.5 font-mono text-[12px] leading-[1.6]">{code}</pre>
      <button
        type="button"
        aria-label="Copy code"
        title="Copy"
        onClick={() => { navigator.clipboard?.writeText(code); toast.success("Copied"); }}
        className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-md border bg-card text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/code:opacity-100"
      >
        <Copy className="size-3" />
      </button>
    </div>
  );
}

/** ucode's replies: paragraphs, lists, headings and code blocks. Small on purpose. */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); i++) code.push(lines[i]);
      blocks.push(<Code key={i} code={code.join("\n")} />);
    } else if (/^#{1,4}\s/.test(line)) {
      const level = /^#+/.exec(line)?.[0].length ?? 1;
      blocks.push(<p key={i} className={level <= 2 ? "pt-1 text-[15px] font-semibold tracking-tight" : "pt-0.5 font-semibold"}>{inline(line.replace(/^#+\s/, ""))}</p>);
    } else if (/^\s*([-*•]|\d+\.)\s/.test(line)) {
      const list: string[] = [];
      const ordered = /^\s*\d+\./.test(line);
      for (; i < lines.length && /^\s*([-*•]|\d+\.)\s/.test(lines[i]); i++) list.push(lines[i].replace(/^\s*([-*•]|\d+\.)\s/, ""));
      i--;
      const Tag = ordered ? "ol" : "ul";
      blocks.push(<Tag key={i} className={`${ordered ? "list-decimal" : "list-disc"} space-y-0.5 pl-[18px] marker:text-muted-foreground`}>{list.map((l, j) => <li key={j} className="pl-0.5">{inline(l)}</li>)}</Tag>);
    } else if (line.trim()) {
      const para: string[] = [line];
      for (i++; i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|\s*([-*•]|\d+\.)\s)/.test(lines[i]); i++) para.push(lines[i]);
      i--;
      blocks.push(<p key={i}>{para.map((p, j) => <Fragment key={j}>{j > 0 && <br />}{inline(p)}</Fragment>)}</p>);
    }
  }
  return <div className="space-y-2.5 text-[13.5px] leading-[1.6] break-words">{blocks}</div>;
}
