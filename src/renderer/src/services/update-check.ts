import { useCallback, useMemo, useSyncExternalStore } from "react";
import useSWR, { mutate as mutateGlobal, SWRConfiguration } from "swr";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { isTauriEnv } from "@/utils/tauri-env";

const SWR_KEY = "update/check" as const;

const fetchUpdate = async (): Promise<Update | null> => {
  if (!isTauriEnv()) return null;

  try {
    const result = await check();
    return result;
  } catch (error) {
    console.error("[update-check] failed to check for updates", error);
    return null;
  }
};

export interface UpdateSnapshot {
  version: string;
  currentVersion: string;
  body?: string;
  date?: string;
  rawJson?: Record<string, unknown>;
  source: "tauri" | "mock";
}

const mapUpdateToSnapshot = (
  update: Update,
  source: "tauri" | "mock",
): UpdateSnapshot => ({
  version: update.version,
  currentVersion: update.currentVersion,
  body: update.body ?? undefined,
  date: update.date ?? undefined,
  rawJson: update.rawJson ?? undefined,
  source,
});

type MockState = {
  active: boolean;
  badgeOnly: boolean;
  snapshot: UpdateSnapshot | null;
};

const defaultMockState: MockState = {
  active: false,
  badgeOnly: false,
  snapshot: null,
};

type MockListener = () => void;

let mockState: MockState = defaultMockState;
const listeners = new Set<MockListener>();

const notifyMockListeners = () => {
  listeners.forEach((listener) => listener());
};

const subscribeMockState = (listener: MockListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getMockSnapshot = () => mockState;

const normalizeEnvFlag = (value: unknown, fallback: boolean) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
};

const DEV_PANEL_ENABLED = (() => {
  const devPref = normalizeEnvFlag(import.meta.env.VITE_UPDATE_DEV_PANEL, true);
  const forceFlag = normalizeEnvFlag(
    import.meta.env.VITE_UPDATE_DEV_PANEL_FORCE,
    false,
  );
  return (import.meta.env.DEV && devPref) || forceFlag;
})();

export const isUpdateDevToolsEnabled = DEV_PANEL_ENABLED;

export interface MockUpdatePayload {
  version: string;
  body?: string;
  currentVersion?: string;
  date?: string;
  badgeOnly?: boolean;
  rawJson?: Record<string, unknown>;
}

const setMockState = (next: MockState) => {
  mockState = next;
  notifyMockListeners();
};

export const setMockUpdate = (payload: MockUpdatePayload) => {
  if (!DEV_PANEL_ENABLED) return;

  const snapshot: UpdateSnapshot = {
    version: payload.version,
    currentVersion: payload.currentVersion ?? "mock",
    body: payload.body,
    date: payload.date,
    rawJson: payload.rawJson,
    source: "mock",
  };

  setMockState({
    active: true,
    badgeOnly: payload.badgeOnly ?? false,
    snapshot,
  });
};

export const clearMockUpdate = () => {
  if (!DEV_PANEL_ENABLED) return;
  setMockState(defaultMockState);
};

export const setMockBadgeOnly = (value: boolean) => {
  if (!DEV_PANEL_ENABLED) return;
  setMockState({
    ...mockState,
    badgeOnly: value,
  });
};

export const useMockUpdateState = () =>
  useSyncExternalStore(subscribeMockState, getMockSnapshot, getMockSnapshot);

export const mutateUpdateCheck = async (): Promise<Update | null> => {
  const result = await mutateGlobal<Update | null>(SWR_KEY);
  return result ?? null;
};

export interface UpdateCheckOptions
  extends Omit<SWRConfiguration<Update | null, unknown>, "fallbackData"> {
  revalidate?: boolean;
}

export interface UseUpdateCheckResult {
  snapshot: UpdateSnapshot | null;
  resource: Update | null;
  isLoading: boolean;
  isValidating: boolean;
  error: unknown;
  isMock: boolean;
  canInstall: boolean;
  badgeOnly: boolean;
  refresh: () => Promise<Update | null>;
}

export const useUpdateCheck = (
  options?: UpdateCheckOptions,
): UseUpdateCheckResult => {
  const swr = useSWR<Update | null>(SWR_KEY, fetchUpdate, {
    revalidateOnFocus: false,
    dedupingInterval: 60 * 60 * 1000,
    focusThrottleInterval: 36e5,
    ...(options ?? {}),
  });

  const mock = useMockUpdateState();

  const snapshot = useMemo<UpdateSnapshot | null>(() => {
    if (mock.active && mock.snapshot) {
      return mock.snapshot;
    }
    if (swr.data) {
      return mapUpdateToSnapshot(swr.data, "tauri");
    }
    return null;
  }, [mock.active, mock.snapshot, swr.data]);

  const dataResource = swr.data ?? null;
  const resource = mock.active ? null : dataResource;
  const canInstall = Boolean(resource);

  const refresh = useCallback(async () => {
    const result = await swr.mutate(undefined, { revalidate: true });
    return result ?? null;
  }, [swr.mutate]);

  return {
    snapshot,
    resource,
    isLoading: swr.isLoading,
    isValidating: swr.isValidating,
    error: swr.error,
    isMock: mock.active,
    canInstall,
    badgeOnly: mock.badgeOnly,
    refresh,
  };
};

type UpdateDevHelper = {
  trigger: (payload: MockUpdatePayload) => void;
  clear: () => void;
  getState: () => MockState;
  setBadgeOnly: (value: boolean) => void;
  refresh: () => Promise<Update | null>;
};

declare global {
  interface Window {
    __OUTCLASH_DEV__?: UpdateDevHelper;
  }
}

if (DEV_PANEL_ENABLED && typeof window !== "undefined") {
  const helper: UpdateDevHelper = {
    trigger: setMockUpdate,
    clear: clearMockUpdate,
    getState: () => mockState,
    setBadgeOnly: setMockBadgeOnly,
    refresh: mutateUpdateCheck,
  };
  window.__OUTCLASH_DEV__ = helper;
}
