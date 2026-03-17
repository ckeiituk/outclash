import { forwardRef, useImperativeHandle, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLockFn } from "ahooks";
import { openWebUrl } from "@/services/cmds";
import { useVerge } from "@/hooks/use-verge";
import { useClashInfo } from "@/hooks/use-clash";
import { showNotice } from "@/services/noticeService";

// Новые импорты
import { DialogRef, BaseEmpty } from "@/components/base";
import { WebUIItem } from "./web-ui-item"; // Наш обновленный компонент
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export const WebUIViewer = forwardRef<DialogRef>((props, ref) => {
  const { t } = useTranslation();
  const { clashInfo } = useClashInfo();
  const { verge, patchVerge, mutateVerge } = useVerge();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }));

  const webUIList = verge?.web_ui_list || [
    "https://metacubex.github.io/metacubexd/#/setup?http=true&hostname=%host&port=%port&secret=%secret",
    "https://yacd.metacubex.one/?hostname=%host&port=%port&secret=%secret",
    "https://board.zash.run.place/#/setup?http=true&hostname=%host&port=%port&secret=%secret",
  ];

  // Вся ваша логика остается без изменений
  const handleAdd = useLockFn(async (value: string) => {
    const newList = [...webUIList, value];
    mutateVerge((old) => (old ? { ...old, web_ui_list: newList } : old), false);
    await patchVerge({ web_ui_list: newList });
  });

  const handleChange = useLockFn(async (index: number, value?: string) => {
    const newList = [...webUIList];
    newList[index] = value ?? "";
    mutateVerge((old) => (old ? { ...old, web_ui_list: newList } : old), false);
    await patchVerge({ web_ui_list: newList });
  });

  const handleDelete = useLockFn(async (index: number) => {
    const newList = [...webUIList];
    newList.splice(index, 1);
    mutateVerge((old) => (old ? { ...old, web_ui_list: newList } : old), false);
    await patchVerge({ web_ui_list: newList });
  });

  const handleOpenUrl = useLockFn(async (value?: string) => {
    if (!value) return;
    try {
      let url = value.trim().replaceAll("%host", "127.0.0.1");

      if (url.includes("%port") || url.includes("%secret")) {
        if (!clashInfo) throw new Error("failed to get clash info");
        if (!clashInfo.server?.includes(":")) {
          throw new Error(`failed to parse the server "${clashInfo.server}"`);
        }
        const port = clashInfo.server
          .slice(clashInfo.server.indexOf(":") + 1)
          .trim();
        url = url.replaceAll("%port", port || "9097");
        url = url.replaceAll(
          "%secret",
          encodeURIComponent(clashInfo.secret || ""),
        );
      }
      await openWebUrl(url);
    } catch (e: any) {
      showNotice("error", e.message || e.toString());
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="pr-7">
          <div className="flex justify-between items-center">
            <DialogTitle>{t("Web UI")}</DialogTitle>
            <Button
              size="sm"
              disabled={editing}
              onClick={() => setEditing(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("New")}
            </Button>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
          {!editing && webUIList.length === 0 ? (
            <div className="h-40">
              {" "}
              {/* Задаем высоту для центрирования */}
              <BaseEmpty
                extra={
                  <p className="mt-2 text-xs text-center">
                    {t("Replace host, port, secret with %host, %port, %secret")}
                  </p>
                }
              />
            </div>
          ) : (
            webUIList.map((item, index) => (
              <WebUIItem
                key={index}
                value={item}
                onChange={(v) => handleChange(index, v)}
                onDelete={() => handleDelete(index)}
                onOpenUrl={handleOpenUrl}
              />
            ))
          )}
          {editing && (
            <WebUIItem
              value=""
              onlyEdit
              onChange={(v) => {
                setEditing(false);
                if (v) handleAdd(v);
              }}
              onCancel={() => setEditing(false)}
            />
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("Close")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
