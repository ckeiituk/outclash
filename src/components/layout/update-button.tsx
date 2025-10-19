import { useEffect, useMemo, useRef } from "react";
import { UpdateViewer } from "../setting/mods/update-viewer";
import { DialogRef } from "../base";
import { Button } from "@/components/ui/button";
import { t } from "i18next";
import { Download } from "lucide-react";
import { useSidebar } from "../ui/sidebar";
import { cn } from "@root/lib/utils";
import { useUpdateCheck } from "@/services/update-check";

interface Props {
  className?: string;
}

export const UpdateButton = (props: Props) => {
  const { className } = props;
  const { state: sidebarState } = useSidebar();
  const viewerRef = useRef<DialogRef>(null);
  const { snapshot, badgeOnly } = useUpdateCheck();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      viewerRef.current?.open();
    };
    window.addEventListener("outclash:open-update-viewer", handler);
    return () =>
      window.removeEventListener("outclash:open-update-viewer", handler);
  }, []);

  const hasUpdate = Boolean(snapshot);
  const label = snapshot
    ? `${t("New update")} v${snapshot.version}`
    : t("New update");
  const indicator = useMemo(() => {
    if (!hasUpdate) return null;
    return (
      <span className="pointer-events-none absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_2px_rgba(15,23,42,0.65)] dark:shadow-[0_0_0_2px_rgba(15,23,42,0.95)]" />
      </span>
    );
  }, [hasUpdate]);

  if (!hasUpdate) return null;

  return (
    <>
      <UpdateViewer ref={viewerRef} />
      {sidebarState === "collapsed" ? (
        <Button
          variant="outline"
          size="icon"
          className={cn("relative", className)}
          aria-label={label}
          disabled={badgeOnly}
          onClick={() => {
            if (badgeOnly) return;
            viewerRef.current?.open();
          }}
        >
          {indicator}
          <Download />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="lg"
          className={cn("relative gap-2", className)}
          disabled={badgeOnly}
          onClick={() => {
            if (badgeOnly) return;
            viewerRef.current?.open();
          }}
        >
          {indicator}
          <Download />
          {label}
        </Button>
      )}
    </>
  );
};
