import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  clearMockUpdate,
  isUpdateDevToolsEnabled,
  setMockBadgeOnly,
  setMockUpdate,
  useMockUpdateState,
  useUpdateCheck,
} from "@/services/update-check";
import { cn } from "@root/lib/utils";
import {
  RefreshCw,
  Sparkles,
  XCircle,
  FlaskConical,
  BadgeInfo,
  Eye,
  EyeOff,
} from "lucide-react";

const PANEL_MARGIN = 16;
const DRAG_HANDLE_ATTR = "data-update-dev-drag";
const STORAGE_KEY = "outclash:updateDevPanel";

type PanelPersistedState = {
  x: number;
  y: number;
  hidden: boolean;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const readPersistedState = (): PanelPersistedState => {
  if (typeof window === "undefined") {
    return { x: PANEL_MARGIN, y: PANEL_MARGIN, hidden: false };
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { x: PANEL_MARGIN, y: PANEL_MARGIN, hidden: false };
    const parsed = JSON.parse(raw) as Partial<PanelPersistedState>;
    return {
      x: typeof parsed.x === "number" ? parsed.x : PANEL_MARGIN,
      y: typeof parsed.y === "number" ? parsed.y : PANEL_MARGIN,
      hidden: Boolean(parsed.hidden),
    };
  } catch {
    return { x: PANEL_MARGIN, y: PANEL_MARGIN, hidden: false };
  }
};

const persistState = (state: PanelPersistedState) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore persistence failures silently
  }
};

export const UpdateDevPanel = () => {
  if (!isUpdateDevToolsEnabled) return null;

  const { snapshot, isMock, badgeOnly, refresh } = useUpdateCheck();
  const mockState = useMockUpdateState();

  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const persisted = useRef(readPersistedState());
  const [position, setPosition] = useState({
    x: persisted.current.x,
    y: persisted.current.y,
  });
  const [hidden, setHidden] = useState(persisted.current.hidden);

  useEffect(() => {
    persistState({ x: position.x, y: position.y, hidden });
  }, [position.x, position.y, hidden]);

  const clampPosition = useCallback((x: number, y: number) => {
    if (typeof window === "undefined") return { x, y };
    const node = panelRef.current;
    if (!node) return { x, y };
    const { width, height } = node.getBoundingClientRect();
    const maxX = Math.max(
      window.innerWidth - width - PANEL_MARGIN,
      PANEL_MARGIN,
    );
    const maxY = Math.max(
      window.innerHeight - height - PANEL_MARGIN,
      PANEL_MARGIN,
    );
    return {
      x: clamp(x, PANEL_MARGIN, maxX),
      y: clamp(y, PANEL_MARGIN, maxY),
    };
  }, []);

  const endDrag = useCallback((pointerId: number) => {
    const state = dragState.current;
    if (!state || state.pointerId !== pointerId) return;
    const node = panelRef.current;
    if (node?.hasPointerCapture(pointerId)) {
      node.releasePointerCapture(pointerId);
    }
    dragState.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const handle = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        `[${DRAG_HANDLE_ATTR}]`,
      );
      if (!handle || !panelRef.current?.contains(handle)) return;

      panelRef.current.setPointerCapture(event.pointerId);
      dragState.current = {
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        startX: position.x,
        startY: position.y,
      };
      event.preventDefault();
    },
    [position.x, position.y],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = dragState.current;
      if (!state || event.pointerId !== state.pointerId) return;

      const next = clampPosition(
        state.startX + (event.clientX - state.originX),
        state.startY + (event.clientY - state.originY),
      );
      setPosition(next);
    },
    [clampPosition],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      endDrag(event.pointerId);
    },
    [endDrag],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      endDrag(event.pointerId);
    },
    [endDrag],
  );

  const triggerMock = useCallback(() => {
    const now = new Date();
    const versionSuffix = now
      .toISOString()
      .replace(/[-:.TZ]/g, "")
      .slice(-6);
    setMockUpdate({
      version: `9.9.${versionSuffix}`,
      currentVersion: snapshot?.currentVersion ?? "dev",
      body: `• Mock build generated at ${now.toLocaleTimeString()}`,
    });
  }, [snapshot?.currentVersion]);

  const toggleBadge = useCallback(() => {
    setMockBadgeOnly(!mockState.badgeOnly);
  }, [mockState.badgeOnly]);

  const openViewer = useCallback(() => {
    window.dispatchEvent(new Event("outclash:open-update-viewer"));
  }, []);

  const panelLabel = useMemo(() => {
    if (mockState.active && mockState.snapshot) {
      return `Mock v${mockState.snapshot.version}`;
    }
    if (snapshot) {
      return `Update v${snapshot.version}`;
    }
    return "No update";
  }, [mockState.active, mockState.snapshot, snapshot]);

  if (hidden) {
    return (
      <button
        type="button"
        className="fixed left-4 top-4 z-50 flex items-center gap-2 rounded-full bg-background/80 px-3 py-2 text-xs font-medium shadow-md backdrop-blur hover:bg-background"
        onClick={() => setHidden(false)}
      >
        <Eye className="h-3.5 w-3.5" /> Dev panel
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        "fixed z-50 w-72 select-none rounded-lg border border-border bg-background/95 p-3 text-xs shadow-lg backdrop-blur",
        "ring-1 ring-black/5",
      )}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex flex-col" {...{ [DRAG_HANDLE_ATTR]: true }}>
          <span className="font-semibold text-foreground">
            Update Dev Panel
          </span>
          <span className="text-[11px] text-muted-foreground">
            {panelLabel}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setHidden(true)}
        >
          <EyeOff className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid gap-2">
        <Button
          variant="outline"
          size="sm"
          className="justify-start gap-2"
          onClick={triggerMock}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Force mock update
        </Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 justify-start gap-2"
            onClick={openViewer}
            disabled={!snapshot}
          >
            <BadgeInfo className="h-3.5 w-3.5" />
            Open viewer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => {
              clearMockUpdate();
            }}
            disabled={!isMock}
          >
            <XCircle className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 justify-start gap-2"
            onClick={() => {
              void refresh();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Revalidate
          </Button>
          <Button
            variant={badgeOnly ? "default" : "outline"}
            size="sm"
            className="flex-1 justify-start gap-2"
            onClick={toggleBadge}
            disabled={!mockState.active}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Badge only
          </Button>
        </div>
      </div>
    </div>
  );
};
