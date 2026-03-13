export type Workspace = {
  id: string;
  name: string;
  key: string;
  defaultLocation?: string;
  defaultCurrency?: string;
};

const safeJsonParse = (value?: string) => {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const defaultWorkspace = (): Workspace => ({
  id: "unitech",
  name: "Unitech Cabels",
  key: process.env.DEFAULT_WORKSPACE_KEY || "unitech-demo",
  defaultLocation: "United States",
  defaultCurrency: "USD"
});

export const getWorkspaces = (): Workspace[] => {
  const env = safeJsonParse(process.env.WORKSPACES_JSON);
  if (Array.isArray(env)) {
    const cleaned = env
      .map((item) => ({
        id: String(item.id || "").trim(),
        name: String(item.name || "").trim(),
        key: String(item.key || "").trim(),
        defaultLocation: item.defaultLocation ? String(item.defaultLocation) : undefined,
        defaultCurrency: item.defaultCurrency ? String(item.defaultCurrency) : undefined
      }))
      .filter((item) => item.id && item.name && item.key);
    if (cleaned.length) return cleaned;
  }
  return [defaultWorkspace()];
};

export const getWorkspaceById = (workspaceId: string) =>
  getWorkspaces().find((workspace) => workspace.id === workspaceId);

export const validateWorkspaceKey = (workspaceId: string, key: string) => {
  const workspace = getWorkspaceById(workspaceId);
  if (!workspace) return false;
  return workspace.key === key;
};
