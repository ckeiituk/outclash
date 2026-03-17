import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { mutate } from "swr";
import React, { useEffect, useState, useCallback } from "react";
import { useLockFn } from "ahooks";
import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLoadingCache, useSetLoadingCache } from "@/services/states";
import {
  viewProfile,
  updateProfile,
  readProfileFile,
  saveProfileFile,
} from "@/services/cmds";
import { showNotice } from "@/services/noticeService";
import { GroupsEditorViewer } from "@/components/profile/groups-editor-viewer";
import { RulesEditorViewer } from "@/components/profile/rules-editor-viewer";
import { EditorViewer } from "@/components/profile/editor-viewer";
import parseTraffic from "@/utils/parse-traffic";
import { ConfirmViewer } from "@/components/profile/confirm-viewer";
import { open } from "@tauri-apps/plugin-shell";
import { ProxiesEditorViewer } from "./proxies-editor-viewer";
import { cn } from "@root/lib/utils";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuPortal,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import {
  GripVertical,
  File as FileIcon,
  Globe,
  Clock,
  AlertTriangle,
  Loader2,
  Info,
  DownloadCloud,
  Download,
  Trash2,
  Edit3,
  FileText as FileTextIcon,
  ExternalLink,
  FolderOpen,
  ListChecks,
  ListFilter,
  ListTree,
  CheckCircle,
  Infinity,
  RefreshCw,
  Network,
} from "lucide-react";
import { t } from "i18next";

dayjs.extend(relativeTime);

const parseUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch (e) {
    return url.length > 25 ? `${url.substring(0, 22)}...` : url;
  }
};

const parseExpire = (expire?: number | string): string | null => {
  if (!expire) return null;
  const expireTimestamp =
    typeof expire === "string" ? parseInt(expire, 10) : expire;
  if (isNaN(expireTimestamp) || expireTimestamp === 0) return null;
  const expireDate = dayjs(expireTimestamp * 1000);
  if (!expireDate.isValid()) return null;
  const now = dayjs();
  if (expireDate.isBefore(now)) return t("Expired");
  return t("Expires in", { duration: expireDate.fromNow(true) });
};

type MenuItemAction = {
  label: string;
  handler: () => void;
  icon: React.ElementType;
  disabled?: boolean;
  isDestructive?: boolean;
};

interface Props {
  id: string;
  selected: boolean;
  activating: boolean;
  itemData: IProfileItem;
  onSelect: (force: boolean) => void;
  onEdit: () => void;
  onSave?: (prev?: string, curr?: string) => void;
  onDelete: () => void;
}

export const ProfileItem = (props: Props) => {
  const { selected, activating, itemData, onSelect, onEdit, onSave, onDelete } =
    props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id });
  const { t } = useTranslation();

  const loadingCache = useLoadingCache();
  const setLoadingCache = useSetLoadingCache();

  const {
    uid,
    name = "Profile",
    type,
    url,
    desc,
    extra,
    updated = 0,
    option,
    home,
  } = itemData;

  const hasUrl = !!url;
  const hasExtra = !!extra;
  const hasHome = !!home;

  const { upload = 0, download = 0, total = 0 } = extra ?? {};
  const parsedHostname = parseUrl(url);
  const description = desc;
  const expireInfo = parseExpire(extra?.expire);
  const progress =
    total > 0
      ? Math.min(Math.round(((download + upload) * 100) / total), 100)
      : 0;
  const isLoading = loadingCache[itemData.uid] ?? false;

  const [, setRefresh] = useState({});
  useEffect(() => {
    if (!updated) return;
    let timer: any = null;
    const handler = () => {
      const now = Date.now();
      const lastUpdate = updated * 1000;
      if (now - lastUpdate >= 24 * 36e5) return;
      const wait = now - lastUpdate >= 36e5 ? 30e5 : 5e4;
      timer = setTimeout(() => {
        setRefresh({});
        handler();
      }, wait);
    };
    handler();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [hasUrl, updated]);

  const [fileOpen, setFileOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [proxiesOpen, setProxiesOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onOpenHome = () => open(home ?? "");
  const onEditInfo = onEdit;
  const onEditFile = () => setFileOpen(true);
  const onEditRules = () => setRulesOpen(true);
  const onEditProxies = () => setProxiesOpen(true);
  const onEditGroups = () => setGroupsOpen(true);
  const onForceSelect = () => onSelect(true);

  const onOpenFile = useLockFn(async () => {
    try {
      await viewProfile(itemData.uid);
    } catch (err: any) {
      showNotice("error", err?.message || err.toString());
    }
  });

  const onUpdate = useLockFn(async (updateType: 0 | 1 | 2): Promise<void> => {
    setLoadingCache((cache) => ({ ...cache, [itemData.uid]: true }));
    const updateOption: Partial<IProfileOption> = {};
    if (updateType === 0) {
      updateOption.with_proxy = false;
      updateOption.self_proxy = false;
    } else if (updateType === 2) {
      if (itemData.option?.self_proxy) {
        updateOption.with_proxy = false;
        updateOption.self_proxy = true;
      } else {
        updateOption.with_proxy = true;
        updateOption.self_proxy = false;
      }
    }
    try {
      await updateProfile(itemData.uid, updateOption);
      showNotice("success", t("Update subscription successfully"));
      mutate("getProfiles");
    } catch (err: any) {
      // Errors handled by global notice listeners
    } finally {
      setLoadingCache((cache) => ({ ...cache, [itemData.uid]: false }));
    }
  });

  useEffect(() => {
    const handleUpdateStarted = (event: CustomEvent) => {
      if (event.detail.uid === itemData.uid) {
        setLoadingCache((cache) => ({ ...cache, [itemData.uid]: true }));
      }
    };
    const handleUpdateCompleted = (event: CustomEvent) => {
      if (event.detail.uid === itemData.uid) {
        setLoadingCache((cache) => ({ ...cache, [itemData.uid]: false }));
      }
    };
    window.addEventListener(
      "profile-update-started",
      handleUpdateStarted as EventListener,
    );
    window.addEventListener(
      "profile-update-completed",
      handleUpdateCompleted as EventListener,
    );
    return () => {
      window.removeEventListener(
        "profile-update-started",
        handleUpdateStarted as EventListener,
      );
      window.removeEventListener(
        "profile-update-completed",
        handleUpdateCompleted as EventListener,
      );
    };
  }, [itemData.uid, setLoadingCache]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : undefined,
  };

  const homeMenuItem: MenuItemAction[] = hasHome
    ? [{ label: "Home", handler: onOpenHome, icon: ExternalLink }]
    : [];

  const mainMenuItems: MenuItemAction[] = [
    { label: "Select", handler: onForceSelect, icon: CheckCircle },
    { label: "Edit Info", handler: onEditInfo, icon: Edit3 },
    { label: "Edit File", handler: onEditFile, icon: FileTextIcon },
    { label: "Open File", handler: onOpenFile, icon: FolderOpen },
  ];

  const editMenuItems: MenuItemAction[] = [
    {
      label: "Edit Rules",
      handler: onEditRules,
      disabled: !option?.rules,
      icon: ListChecks,
    },
    {
      label: "Edit Proxies",
      handler: onEditProxies,
      disabled: !option?.proxies,
      icon: ListFilter,
    },
    {
      label: "Edit Groups",
      handler: onEditGroups,
      disabled: !option?.groups,
      icon: ListTree,
    },
  ];

  const deleteMenuItem: MenuItemAction = {
    label: "Delete",
    handler: () => setConfirmOpen(true),
    icon: Trash2,
    isDestructive: true,
  };

  const MAX_NAME_LENGTH = 25;
  const truncatedName =
    name.length > MAX_NAME_LENGTH
      ? `${name.slice(0, MAX_NAME_LENGTH)}...`
      : name;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <ContextMenu>
        <ContextMenuTrigger>
          <Card
            className={cn(
              "overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-200",
              selected && "ring-2 ring-primary shadow-xl",
              isDragging && "opacity-75 shadow-2xl scale-105",
              activating && "cursor-default",
            )}
            onClick={() => !activating && onSelect(false)}
          >
            {activating && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-20 rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            <div className="px-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    {...listeners}
                    className="cursor-grab touch-none py-1 text-muted-foreground hover:bg-accent rounded-sm"
                  >
                    <GripVertical className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold truncate" title={name}>
                    {name}
                  </p>
                  {expireInfo === t("Expired") ? (
                    <Badge
                      variant="destructive"
                      className="text-xs bg-red-500 text-white dark:bg-red-500"
                    >
                      {t(expireInfo)}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex items-center flex-shrink-0">
                  <Badge variant="outline" className="text-xs shadow-sm">
                    {type}
                  </Badge>
                </div>
              </div>

              <div className="mt-2 text-xs text-muted-foreground space-y-1.5">
                <p
                  className="truncate"
                  title={desc || (hasUrl ? url : t("Local File"))}
                >
                  <Info className="h-3 w-3 inline mr-1.5" />
                  {desc || parsedHostname || t("Local File")}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Clock className="h-3 w-3 inline mr-1.5" />
                    <span>
                      {expireInfo === null ? (
                        <Infinity className="h-3 w-3 inline mr-1.5" />
                      ) : (
                        expireInfo
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <RefreshCw className="h-3 w-3 inline mr-1.5" />
                    <span>
                      {updated > 0
                        ? dayjs(updated * 1000).fromNow()
                        : t("Never")}
                    </span>
                    {isLoading && (
                      <Loader2 className="h-3 w-3 ml-1.5 animate-spin" />
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Download className="h-3 w-3 inline mr-1.5" />
                    <span className="pr-5">{parseTraffic(download)}</span>
                    <Network className="h-3 w-3 inline mr-1.5" />
                    {total > 0 ? (
                      <span>{parseTraffic(total)}</span>
                    ) : (
                      <Infinity className="h-3 w-3 inline mr-1.5" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </ContextMenuTrigger>

        <ContextMenuContent
          className="w-56"
          onClick={(e) => e.stopPropagation()}
        >
          {[...homeMenuItem, ...mainMenuItems].map((item) => (
            <ContextMenuItem
              key={item.label}
              onSelect={item.handler}
              disabled={item.disabled}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{t(item.label)}</span>
            </ContextMenuItem>
          ))}
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger disabled={!hasUrl || isLoading}>
              <DownloadCloud className="mr-2 h-4 w-4" />
              <span className="px-2">{t("Update")}</span>
            </ContextMenuSubTrigger>
            <ContextMenuPortal>
              <ContextMenuSubContent>
                <ContextMenuItem onSelect={() => onUpdate(0)}>
                  {t("Update")}
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => onUpdate(2)}>
                  {t("Update via proxy")}
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuPortal>
          </ContextMenuSub>
          <ContextMenuSeparator />
          {editMenuItems.map((item) => (
            <ContextMenuItem
              key={item.label}
              onSelect={item.handler}
              disabled={item.disabled}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{t(item.label)}</span>
            </ContextMenuItem>
          ))}
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={deleteMenuItem.handler}
            className={cn(
              deleteMenuItem.isDestructive &&
                "text-destructive focus:text-destructive focus:bg-destructive/10",
            )}
          >
            <deleteMenuItem.icon className="mr-2 h-4 w-4" />
            <span>{t(deleteMenuItem.label)}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {fileOpen && (
        <EditorViewer
          open={true}
          title={`${t("Edit File")}: ${name}`}
          onClose={() => setFileOpen(false)}
          initialData={readProfileFile(uid)}
          language="yaml"
          schema="clash"
          onSave={async (p, c) => {
            await saveProfileFile(uid, c || "");
            onSave?.(p, c);
          }}
        />
      )}

      {rulesOpen && (
        <RulesEditorViewer
          open={true}
          onClose={() => setRulesOpen(false)}
          profileUid={uid}
          property={option?.rules ?? ""}
          groupsUid={option?.groups ?? ""}
          mergeUid={option?.merge ?? ""}
          onSave={onSave}
        />
      )}

      {proxiesOpen && (
        <ProxiesEditorViewer
          open={true}
          onClose={() => setProxiesOpen(false)}
          profileUid={uid}
          property={option?.proxies ?? ""}
          onSave={onSave}
        />
      )}

      {groupsOpen && (
        <GroupsEditorViewer
          open={true}
          onClose={() => setGroupsOpen(false)}
          profileUid={uid}
          property={option?.groups ?? ""}
          proxiesUid={option?.proxies ?? ""}
          mergeUid={option?.merge ?? ""}
          onSave={onSave}
        />
      )}

      <ConfirmViewer
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={onDelete}
        title={t("Delete Profile", { name: truncatedName })}
        description={t("This action cannot be undone.")}
      />
    </div>
  );
};
