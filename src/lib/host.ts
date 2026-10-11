/**
 * The MCP Apps host bridge: the few JSON-RPC calls a Meridian view makes when a host (an AI chat client) renders it
 * as a `ui://` resource. Specification: modelcontextprotocol/ext-apps, protocol 2026-01-26.
 *
 * Dependency-free on purpose. A product that already uses @modelcontextprotocol/ext-apps can replace this module with
 * its `App` and keep every component unchanged: components only see `useSurface()`.
 */
const PROTOCOL = '2026-01-26';

export type DisplayMode = 'inline' | 'fullscreen' | 'pip';
export type HostContext = {
  theme?: 'light' | 'dark';
  displayMode?: DisplayMode;
  availableDisplayModes?: DisplayMode[];
  containerDimensions?: { width?: number; height?: number; maxWidth?: number; maxHeight?: number };
  safeAreaInsets?: { top: number; right: number; bottom: number; left: number };
  platform?: 'web' | 'desktop' | 'mobile';
  locale?: string;
  timeZone?: string;
  deviceCapabilities?: { touch?: boolean; hover?: boolean };
  styles?: { variables?: Record<string, string> };
};

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

export class HostBridge {
  private seq = 0;
  private pending = new Map<number, Pending>();
  private listeners = new Set<(ctx: HostContext) => void>();
  private toolListeners = new Set<(kind: 'input' | 'result', params: unknown) => void>();
  context: HostContext = {};

  constructor(private target: Window = window.parent) {
    window.addEventListener('message', this.onMessage);
  }

  /** Stop listening. The embed surface calls this when it unmounts: the handler is on `window`, which outlives the
   *  component, so a bridge that is never disposed keeps a listener — and everything it closes over — alive for the
   *  life of the page. React runs an effect twice in development, so this is not only a production concern. */
  dispose() {
    window.removeEventListener('message', this.onMessage);
    this.pending.clear();
    this.listeners.clear();
    this.toolListeners.clear();
  }

  /** True when this document is framed by someone who might be a host. Standalone pages never start the bridge. */
  static framed() {
    try { return typeof window !== 'undefined' && window.parent !== window; } catch { return true; }
  }

  private onMessage = (e: MessageEvent) => {
    if (e.source !== this.target) return;
    const m = e.data;
    if (!m || m.jsonrpc !== '2.0') return;
    if (m.id !== undefined && ('result' in m || 'error' in m) && this.pending.has(m.id)) {
      const p = this.pending.get(m.id)!;
      this.pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error.message ?? 'host error'));
      else p.resolve(m.result);
      return;
    }
    if (m.method === 'ui/notifications/host-context-changed') this.update(m.params ?? {});
    if (m.method === 'ui/notifications/tool-input') this.toolListeners.forEach((l) => l('input', m.params));
    if (m.method === 'ui/notifications/tool-result') this.toolListeners.forEach((l) => l('result', m.params));
  };

  private update(patch: HostContext) {
    this.context = { ...this.context, ...patch };
    this.listeners.forEach((l) => l(this.context));
  }

  request<T = unknown>(method: string, params?: unknown, timeout = 8000): Promise<T> {
    const id = ++this.seq;
    this.target.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      setTimeout(() => this.pending.has(id) && (this.pending.delete(id), reject(new Error(`${method} timed out`))), timeout);
    });
  }

  notify(method: string, params?: unknown) {
    this.target.postMessage({ jsonrpc: '2.0', method, params }, '*');
  }

  /** Handshake with the host. Retried, because a host may start listening after the frame has loaded. */
  async initialize(name: string, version: string, attempts = 4) {
    const params = { protocolVersion: PROTOCOL, clientInfo: { name, version }, appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] } };
    let r: { hostContext?: HostContext } | undefined;
    for (let i = 0; i < attempts && !r; i++) {
      r = await this.request<{ hostContext?: HostContext }>('ui/initialize', params, 1200 * (i + 1)).catch(() => undefined);
    }
    if (!r) throw new Error('the host did not answer ui/initialize');
    this.update(r.hostContext ?? {});
    this.notify('ui/notifications/initialized');
    return this.context;
  }

  onContext(l: (ctx: HostContext) => void) { this.listeners.add(l); return () => void this.listeners.delete(l); }
  onTool(l: (kind: 'input' | 'result', params: unknown) => void) { this.toolListeners.add(l); return () => void this.toolListeners.delete(l); }

  sizeChanged(width: number, height: number) { this.notify('ui/notifications/size-changed', { width, height }); }
  requestDisplayMode(mode: DisplayMode) { return this.request<{ mode: DisplayMode }>('ui/request-display-mode', { mode }); }
  /** Say something in the conversation as the person: "Why did errors rise on 21 September?" */
  message(text: string) { return this.request('ui/message', { role: 'user', content: { type: 'text', text } }); }
  /** Tell the model what the person is looking at, so a question about "this" has a referent. */
  modelContext(text: string, structured?: object) {
    return this.request('ui/update-model-context', { content: [{ type: 'text', text }], structuredContent: structured });
  }
  openLink(url: string) { return this.request('ui/open-link', { url }); }
  callTool(name: string, args: Record<string, unknown>) { return this.request('tools/call', { name, arguments: args }, 30000); }
}
