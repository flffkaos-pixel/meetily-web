const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request(path: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 401) { localStorage.removeItem("token"); window.location.href = "/login"; return null; }
  if (res.status === 402) { window.location.href = "/pricing?limit=true"; return null; }
  if (!res.ok) { const err = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(err.detail || "Request failed"); }
  return res.json();
}

export const api = {
  login: (email: string, password: string) => {
    const body = new FormData(); body.append("email", email); body.append("password", password);
    return request("/api/auth/login", { method: "POST", body });
  },
  register: (email: string, password: string, name?: string) => {
    const body = new FormData(); body.append("email", email); body.append("password", password); if (name) body.append("name", name);
    return request("/api/auth/register", { method: "POST", body });
  },
  me: () => request("/api/auth/me"),
  getMeetings: () => request("/api/meetings"),
  getMeeting: (id: string) => request(`/api/meetings/${id}`),
  deleteMeeting: (id: string) => request(`/api/meetings/${id}`, { method: "DELETE" }),
  updateTitle: (id: string, title: string) => {
    const body = new FormData(); body.append("title", title);
    return request(`/api/meetings/${id}/title`, { method: "PUT", body });
  },
  transcribe: (file: File, title?: string) => {
    const body = new FormData(); body.append("file", file); if (title) body.append("meeting_title", title);
    return request("/api/transcribe", { method: "POST", body });
  },
  transcribeText: (text: string, title?: string) => {
    const body = new FormData(); body.append("text", text); if (title) body.append("meeting_title", title);
    return request("/api/transcribe/text", { method: "POST", body });
  },
  summarize: (meetingId: string, prompt?: string) => {
    const body = new FormData(); if (prompt) body.append("custom_prompt", prompt);
    return request(`/api/summarize/${meetingId}`, { method: "POST", body });
  },
  getUsage: () => request("/api/usage"),
  getPlans: () => request("/api/plans"),
  createPaypalSubscription: (planId: string) => {
    const body = new FormData(); body.append("plan_id", planId);
    return request("/api/paypal/create-subscription", { method: "POST", body });
  },
  cancelPaypalSubscription: () => request("/api/paypal/cancel", { method: "POST" }),
};
