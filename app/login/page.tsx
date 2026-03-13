"use client";

import { useEffect, useState } from "react";

type Workspace = {
  id: string;
  name: string;
};

export default function LoginPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/workspaces");
      const data = await response.json();
      const list = data.workspaces || [];
      setWorkspaces(list);
      if (list.length && !workspaceId) setWorkspaceId(list[0].id);
    };
    load();
  }, [workspaceId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, email, key })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login failed");
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 520 }}>
      <header>
        <h1>Unitech Cabels Metal Intelligence</h1>
        <p>Sign in to your workspace to access analytics, vendor intel, and alerts.</p>
      </header>
      <section className="card">
        <h3>Workspace Access</h3>
        <form onSubmit={submit} className="controls">
          <div>
            <label>Workspace</label>
            <select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div>
            <label>Workspace Key</label>
            <input
              type="password"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              required
            />
          </div>
          <div>
            <label>&nbsp;</label>
            <button type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </div>
        </form>
        {error ? <p className="small" style={{ color: "#e46f6f" }}>{error}</p> : null}
      </section>
    </main>
  );
}
