import { useEffect, useState, useCallback } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { isTauriEnv as getIsTauriEnv } from "@/utils/tauri-env";

// Константы для управления масштабом
const ZOOM_STEP = 0.1;
const ZOOM_WHEEL_STEP = 0.05;
const MIN_ZOOM = 0.5; // 50%
const MAX_ZOOM = 2.0; // 200%

export const useZoomControls = () => {
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const isTauriEnv = getIsTauriEnv();

  interface ZoomWindowControls {
    innerSize: () => Promise<{ width: number; height: number }>;
    scaleFactor: () => Promise<number>;
    setZoom: (z: number) => Promise<void>;
  }

  // Note: WebviewWindow has a richer API. We narrow to the subset we use.
  // Justification: Tauri typing does not expose a dedicated interface for zoom controls.
  // Follow-up: Replace this with precise types if/when exposed upstream.
  const appWindow: ZoomWindowControls = isTauriEnv
    ? (WebviewWindow.getCurrent() as unknown as ZoomWindowControls)
    : {
        innerSize: async () => ({
          width: window.innerWidth,
          height: window.innerHeight,
        }),
        scaleFactor: async () => 1,
        setZoom: async (_z: number) => {},
      };

  useEffect(() => {
    const setInitialZoom = async () => {
      // Skip in web:dev where Tauri APIs are unavailable
      if (!isTauriEnv) return;
      // 1. Получаем и физический размер, и коэффициент масштабирования
      const size = await appWindow.innerSize();
      const scaleFactor = await appWindow.scaleFactor();

      // 2. Вычисляем логическую ширину
      const logicalWidth = size.width / scaleFactor;

      let initialZoom = 1.0;

      console.log(
        `Physical width: ${size.width}, Scale Factor: ${scaleFactor}, Logical width: ${logicalWidth}`,
      );

      // 3. Используем логическую ширину для принятия решения
      if (logicalWidth < 1300) {
        initialZoom = 1.0;
      } else if (logicalWidth > 2000) {
        initialZoom = 2.0;
      }

      await appWindow.setZoom(initialZoom);
      setZoomLevel(initialZoom);
    };

    setInitialZoom();
  }, []);

  const handleZoom = useCallback(
    (delta: number, isReset = false) => {
      setZoomLevel((currentZoom) => {
        const newZoom = isReset ? 1.0 : currentZoom + delta;
        const clampedZoom = Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM));
        const roundedZoom = Math.round(clampedZoom * 100) / 100;

        // Only set Tauri zoom inside desktop app
        if (isTauriEnv) appWindow.setZoom(roundedZoom);
        const newStrokeWidth = 2 / roundedZoom;
        document.documentElement.style.setProperty(
          "--icon-stroke-width",
          newStrokeWidth.toString(),
        );
        return roundedZoom;
      });
    },
    [appWindow],
  );

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? -ZOOM_WHEEL_STEP : ZOOM_WHEEL_STEP;
        handleZoom(delta);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.code) {
          case "Equal":
          case "NumpadAdd":
            event.preventDefault();
            handleZoom(ZOOM_STEP);
            break;
          case "Minus":
          case "NumpadSubtract":
            event.preventDefault();
            handleZoom(-ZOOM_STEP);
            break;
          case "Digit0":
          case "Numpad0":
            event.preventDefault();
            handleZoom(0, true);
            break;
        }
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleZoom]);
};
