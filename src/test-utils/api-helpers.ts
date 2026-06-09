import { vi } from "vitest";
import { createClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Mock Supabase client — chainable query builder
// ---------------------------------------------------------------------------

interface TerminalResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

interface MockChainConfig {
  /** Map "table.terminal" → result. E.g. "habits.maybeSingle" → { data: null, error: null } */
  results: Record<string, TerminalResult>;
}

export interface MockSupabaseChain {
  from: (table: string) => MockSupabaseChain;
  select: (...args: unknown[]) => MockSupabaseChain;
  eq: (...args: unknown[]) => MockSupabaseChain;
  insert: (...args: unknown[]) => MockSupabaseChain;
  update: (...args: unknown[]) => MockSupabaseChain;
  delete: (...args: unknown[]) => MockSupabaseChain;
  maybeSingle: () => Promise<TerminalResult>;
  single: () => Promise<TerminalResult>;
  then: (resolve?: (value: TerminalResult) => unknown) => Promise<unknown>;
}

function createQueryChain(config: MockChainConfig): MockSupabaseChain {
  let currentTable = "";

  const chain = {} as Record<string, unknown>;

  const intermediary = (name: string) => {
    chain[name] = vi.fn((..._args: unknown[]) => chain);
  };

  // Intermediary methods — each returns the chain itself
  intermediary("select");
  intermediary("eq");
  intermediary("insert");
  intermediary("update");

  // .from() sets the active table and returns the chain
  chain.from = vi.fn((table: string) => {
    currentTable = table;
    return chain;
  });

  // .delete() can be intermediary (with count option) or terminal
  // Supabase's .delete({ count }) returns a chain that still needs .eq() calls,
  // so we always return the chain. The terminal result comes from the awaited chain.
  chain.delete = vi.fn((..._args: unknown[]) => chain);

  // Terminal methods — resolve with configured data
  const terminal = (name: string) => {
    chain[name] = vi.fn(() => {
      const key = `${currentTable}.${name}`;
      return Promise.resolve(config.results[key] ?? { data: null, error: null });
    });
  };

  terminal("maybeSingle");
  terminal("single");

  // .then() makes the chain thenable — used when the chain is awaited directly
  // (e.g. DELETE with count, or UPDATE without .single())
  chain.then = vi.fn((resolve?: (value: TerminalResult) => unknown) => {
    const key = `${currentTable}.then`;
    const result = config.results[key] ?? { data: null, error: null };
    return Promise.resolve(result).then(resolve);
  });

  return chain as unknown as MockSupabaseChain;
}

export function createMockSupabaseClient(config: MockChainConfig): MockSupabaseChain {
  return createQueryChain(config);
}

// ---------------------------------------------------------------------------
// Mock API context builder
// ---------------------------------------------------------------------------

interface MockContextOptions {
  user: { id: string } | null;
  params: Record<string, string>;
  method?: string;
  body?: unknown;
  url?: string;
}

export function createMockContext(options: MockContextOptions) {
  const { user, params, method = "GET", body, url = "http://localhost/api/test" } = options;

  const requestInit: RequestInit = { method, headers: new Headers() };
  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
    (requestInit.headers as Headers).set("Content-Type", "application/json");
  }

  return {
    locals: { user },
    params,
    request: new Request(url, requestInit),
    cookies: {
      getAll: () => [],
      get: () => undefined,
      has: () => false,
      set: vi.fn(),
      delete: vi.fn(),
    },
    redirect: (path: string, status = 302) => new Response(null, { status, headers: { Location: path } }),
    url: new URL(url),
  };
}

// ---------------------------------------------------------------------------
// vi.mock wiring helper
// ---------------------------------------------------------------------------

/**
 * Call in beforeEach after vi.mock("@/lib/supabase", ...) is declared at module scope.
 * The mock MUST use a factory to avoid loading the real module (which imports astro:env/server):
 *   vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }))
 */
export function setupSupabaseMock(mockClient: MockSupabaseChain) {
  vi.mocked(createClient).mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);
}
