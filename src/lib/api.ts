// Talking to ucode: the server that opened this window, on this computer.

export class ApiError extends Error {
  constructor(message: string, public fix?: string) {
    super(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `ucode said no (${res.status})`, body.fix);
  return body as T;
}

export const get = <T = any>(path: string, params: Record<string, string | undefined> = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]);
  return fetch(`/api/${path}${q.size ? `?${q}` : ""}`, { cache: "no-store" }).then((r) => handle<T>(r));
};

export const post = <T = any>(path: string, body: unknown = {}) =>
  fetch(`/api/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => handle<T>(r));

/** A file or a recording, sent as it is. */
export const upload = <T = any>(path: string, data: Blob, name = "file") =>
  fetch(`/api/${path}`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Name": encodeURIComponent(name) }, body: data }).then((r) => handle<T>(r));
