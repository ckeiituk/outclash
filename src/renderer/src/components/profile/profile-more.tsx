import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLockFn } from "ahooks";
import { UnlistenFn } from "@tauri-apps/api/event";
import { viewProfile, readProfileFile, saveProfileFile } from "@/services/cmds";
import { showNotice } from "@/services/noticeService";
import { EditorViewer } from "@/components/profile/editor-viewer";
import { ProfileBox } from "./profile-box"; // Наш рефакторенный компонент
import { LogViewer } from "./log-viewer"; // Наш рефакторенный компонент

// Новые импорты
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollText, FileText, FolderOpen } from "lucide-react";

interface Props {
  logInfo?: [string, string][];
  id: "Merge" | "Script";
  onSave?: (prev?: string, curr?: string) => void;
}

export const ProfileMore = (props: Props) => {
  const { id, logInfo = [], onSave } = props;
  const { t } = useTranslation();

  const [fileOpen, setFileOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const onEditFile = () => {
    setFileOpen(true);
  };

  const onOpenFile = useLockFn(async () => {
    try {
      await viewProfile(id);
    } catch (err: any) {
      showNotice("error", err?.message || err.toString());
    }
  });

  const hasError = !!logInfo.find((e) => e[0] === "exception");

  const menuItems = [
    { label: "Edit File", handler: onEditFile, icon: FileText },
    { label: "Open File", handler: onOpenFile, icon: FolderOpen },
  ];

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          {/* Используем наш готовый ProfileBox */}
          <ProfileBox onDoubleClick={onEditFile}>
            {/* Верхняя строка: Название и Бейдж */}
            <div className="flex justify-between items-center mb-2">
              <p className="font-semibold text-base truncate">
                {t(`Global ${id}`)}
              </p>
              <Badge variant="secondary">{id}</Badge>
            </div>

            {/* Нижняя строка: Кнопка логов или заглушка для сохранения высоты */}
            <div className="h-7 flex items-center">
              {id === "Script" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* Контейнер для позиционирования точки-индикатора */}
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setLogOpen(true)}
                        >
                          <ScrollText className="h-4 w-4" />
                        </Button>
                        {/* Точка-индикатор ошибки с анимацией */}
                        {hasError && (
                          <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                          </span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("Script Console")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </ProfileBox>
        </ContextMenuTrigger>

        {/* Содержимое контекстного меню */}
        <ContextMenuContent>
          {menuItems.map((item) => (
            <ContextMenuItem key={item.label} onSelect={item.handler}>
              <item.icon className="mr-2 h-4 w-4" />
              <span>{t(item.label)}</span>
            </ContextMenuItem>
          ))}
        </ContextMenuContent>
      </ContextMenu>

      {/* Модальные окна, которые мы уже переделали */}
      {fileOpen && (
        <EditorViewer
          open={true}
          title={`${t("Global " + id)}`}
          initialData={readProfileFile(id)}
          language={id === "Merge" ? "yaml" : "javascript"}
          schema={id === "Merge" ? "clash" : undefined}
          onSave={async (prev, curr) => {
            await saveProfileFile(id, curr ?? "");
            onSave?.(prev, curr);
          }}
          onClose={() => setFileOpen(false)}
        />
      )}
      {logOpen && (
        <LogViewer
          open={logOpen}
          logInfo={logInfo}
          onClose={() => setLogOpen(false)}
        />
      )}
    </>
  );
};
