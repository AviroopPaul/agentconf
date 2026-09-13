import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchInventory, type AgentReport, type Inventory } from "./api";

interface State {
  data: Inventory | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
  agent: (id: string) => AgentReport | undefined;
  installed: AgentReport[];
}

const Ctx = createContext<State | null>(null);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh: boolean) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const inv = await fetchInventory(refresh);
      setData(inv);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  // The server answers first with a fast scan (no sizes, no versions) and
  // completes it in the background. Poll until it reports done.
  useEffect(() => {
    if (!data?.probing) return;
    const t = setTimeout(() => void load(false), 900);
    return () => clearTimeout(t);
  }, [data, load]);

  const value = useMemo<State>(
    () => ({
      data,
      loading,
      refreshing,
      error,
      refresh: () => void load(true),
      agent: (id) => data?.agents.find((a) => a.id === id),
      installed: data?.agents.filter((a) => a.installed) ?? [],
    }),
    [data, loading, refreshing, error, load],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInventory(): State {
  const v = useContext(Ctx);
  if (!v) throw new Error("useInventory outside provider");
  return v;
}
