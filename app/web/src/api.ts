// Types mirror app/internal/scan/types.go and doctor.go.

export interface SchemaKey {
  key: string;
  file: string;
  type: string;
  enumValues?: string[];
  default?: unknown;
  scopes: string[];
  category: string;
  summary: string;
  detail?: string;
  docsUrl: string;
  flags?: string[];
  addedIn?: string;
  removedIn?: string;
  concept?: string;
}

export interface KeyStatus extends SchemaKey {
  set: boolean;
  value?: unknown;
  masked?: boolean;
  source?: string;
  matches?: string[];
}

export interface UnknownKey {
  key: string;
  value?: unknown;
  masked?: boolean;
  source: string;
}

export interface SchemaPath {
  path: string;
  kind: string;
  scope: string;
  editable: boolean;
  summary: string;
  docsUrl?: string;
}

export interface PathStatus extends SchemaPath {
  resolved: string;
  exists: boolean;
  isDir: boolean;
  isSymlink: boolean;
  target?: string;
  entries?: number;
  sizeBytes?: number;
  modTime?: string;
}

export interface ConfigFile {
  path: string;
  format: string;
  sizeBytes: number;
  leafCount: number;
  error?: string;
}

export interface KeyStats {
  total: number;
  set: number;
  unset: number;
  deprecatedSet: number;
  experimentalSet: number;
  unknown: number;
}

export interface Skill {
  name: string;
  path: string;
  isSymlink: boolean;
  target?: string;
  realPath: string;
  broken: boolean;
  hasSkillMd: boolean;
  description?: string;
  managed: boolean;
  source: string;
}

export interface SkillPresence {
  present: boolean;
  kind: "symlink" | "dir" | "missing";
  broken?: boolean;
  path?: string;
}

export interface SkillGroup {
  name: string;
  realPath: string;
  description?: string;
  shared: boolean;
  agents: Record<string, SkillPresence>;
  present: number;
  capable: number;
}

export interface MCPServer {
  name: string;
  agent: string;
  transport: string;
  command?: string;
  args?: string[];
  url?: string;
  envKeys?: string[];
  hasHeaders: boolean;
  scope: string;
  project?: string;
  source: string;
  disabled?: boolean;
}

export interface MCPGroup {
  name: string;
  servers: MCPServer[];
  agents: string[];
  consistent: boolean;
}

export interface HookEvent {
  event: string;
  count: number;
  source: string;
}

export interface Plugin {
  name: string;
  version?: string;
  scope?: string;
  enabled?: boolean;
  installedAt?: string;
  lastUpdated?: string;
  source: string;
}

export interface ExtEntry {
  name: string;
  path: string;
  isDir: boolean;
  isSymlink: boolean;
  sizeBytes: number;
}

export interface InstructionFile {
  path: string;
  exists: boolean;
  sizeBytes?: number;
  lines?: number;
  importsAgentsMd?: boolean;
  isSymlink?: boolean;
  target?: string;
}

export interface Usage {
  diskBytes: number;
  fileCount: number;
  sessions?: number;
  messages?: number;
  prompts?: number;
  projects?: number;
  firstActivity?: string;
  lastActivity?: string;
  tokens?: { total: number; input: number; output: number; cacheRead: number; cacheCreation: number; models: number };
  extra?: Record<string, unknown>;
  notes?: string[];
}

export interface AgentReport {
  id: string;
  binaryPath?: string;
  probeError?: string;
  displayName: string;
  vendor: string;
  color: string;
  docsUrl: string;
  homeEnv?: string;
  binary?: string;
  home: string;
  installed: boolean;
  binaryFound: boolean;
  version?: string;
  hasPack: boolean;
  packVersion?: string;
  paths: PathStatus[];
  keys: KeyStatus[];
  unknownKeys: UnknownKey[];
  stats: KeyStats;
  configFiles: ConfigFile[];
  skills: Skill[];
  mcp: MCPServer[];
  hooks: HookEvent[];
  plugins: Plugin[];
  extensions: Record<string, ExtEntry[]>;
  instructions: InstructionFile[];
  usage?: Usage;
  errors?: string[];
}

export interface PackMeta {
  agent: string;
  displayName: string;
  vendor: string;
  packVersion: string;
  sources: string[];
  keyCount: number;
  pathCount: number;
}

export interface Finding {
  id: string;
  severity: "error" | "warn" | "info";
  check: string;
  title: string;
  detail: string;
  agent?: string;
  path?: string;
  docsUrl?: string;
}

export interface DoctorSummary {
  errors: number;
  warns: number;
  infos: number;
}

export interface Inventory {
  generatedAt: string;
  hostname: string;
  userHome: string;
  scanMillis: number;
  fullScanMillis?: number;
  agents: AgentReport[];
  skills: SkillGroup[];
  mcp: MCPGroup[];
  packs: Record<string, PackMeta>;
  doctor: Finding[];
  doctorSummary: DoctorSummary;
  appVersion: string;
  readOnly: boolean;
  probing: boolean;
}

export async function fetchInventory(refresh = false): Promise<Inventory> {
  const res = refresh
    ? await fetch("/api/refresh", { method: "POST" })
    : await fetch("/api/inventory");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res.json();
}
