export const SERVER = process.env.NEXT_PUBLIC_SERVER_URL;

// The server's ANALYST_TOKEN, typed once by the analyst and kept in this browser only.
// A bookmarked link ending #passcode=… saves it once, then strips it from the address bar.
// The #fragment never leaves the browser, so it isn't in server or Vercel logs. Never bake it into the bundle:
// the URL is public, and the passcode places real calls.
export function getPasscode(): string {
  try {
    const m = location.hash.match(/(?:^#|&)passcode=([^&]+)/);
    if (m) {
      localStorage.setItem("analystPasscode", decodeURIComponent(m[1]));
      const view = location.hash.replace(/(?:^#|&)passcode=[^&]+/, "").replace(/^[#&]/, ""); // keeps #estates&passcode=… on estates
      history.replaceState(null, "", location.pathname + location.search + (view ? `#${view}` : ""));
    }
    return localStorage.getItem("analystPasscode") ?? "";
  } catch {
    return "";
  }
}

export function setPasscode(v: string) {
  try {
    localStorage.setItem("analystPasscode", v);
  } catch {}
}

// Returns null on success, otherwise a plain sentence for the person to read.
export async function post(path: string, body?: unknown): Promise<string | null> {
  const r = await send(path, body);
  return typeof r === "string" ? r : null;
}

// Same, but hands back the parsed JSON body on success (a string still means an error).
export async function postJson<T>(path: string, body?: unknown): Promise<T | string> {
  const r = await send(path, body);
  if (typeof r === "string") return r;
  try {
    return (await r.json()) as T;
  } catch {
    return "The server's answer wasn't readable.";
  }
}

async function send(path: string, body?: unknown): Promise<Response | string> {
  if (!SERVER) return "The server address isn't set (NEXT_PUBLIC_SERVER_URL), so this can't be sent.";
  try {
    const res = await fetch(`${SERVER}${path}`, {
      method: "POST",
      // ngrok's free tier serves an HTML interstitial to browsers unless this header is present
      headers: {
        "ngrok-skip-browser-warning": "1",
        "X-Analyst-Token": getPasscode(),
        ...(body !== undefined && { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return res;
    if (res.status === 401) return "The analyst passcode is missing or wrong. Enter it with the Passcode button at the top.";
    const text = await res.text();
    try {
      const detail = JSON.parse(text).detail;
      if (typeof detail === "string") return detail;
    } catch {}
    return `The server answered ${res.status}: ${text.slice(0, 200)}`;
  } catch {
    return "Couldn't reach the server. Check that it's running and the tunnel is up.";
  }
}

export async function pingServer(): Promise<boolean> {
  if (!SERVER) return false;
  try {
    const res = await fetch(`${SERVER}/health`, { headers: { "ngrok-skip-browser-warning": "1" } });
    return res.ok;
  } catch {
    return false;
  }
}
