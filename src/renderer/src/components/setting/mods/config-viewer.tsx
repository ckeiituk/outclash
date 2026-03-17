import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import { getRuntimeYaml } from "@/services/cmds";
import { DialogRef } from "@/components/base";
import { EditorViewer } from "@/components/profile/editor-viewer"; // Наш обновленный компонент

// Новые импорты
import { Badge } from "@/components/ui/badge";

export const ConfigViewer = forwardRef<DialogRef>((_, ref) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [runtimeConfig, setRuntimeConfig] = useState("");

  // useImperativeHandle остается без изменений
  useImperativeHandle(ref, () => ({
    open: () => {
      getRuntimeYaml().then((data) => {
        setRuntimeConfig(data ?? "# Error getting runtime yaml\n");
        setOpen(true);
      });
    },
    close: () => setOpen(false),
  }));

  if (!open) return null;

  return (
    <EditorViewer
      open={true}
      title={
        // --- НАЧАЛО ИЗМЕНЕНИЙ ---
        // Заменяем Box на div и Chip на Badge
        <div className="flex items-center gap-2">
          <span>{t("Runtime Config")}</span>
          <Badge variant="secondary">{t("ReadOnly")}</Badge>
        </div>
        // --- КОНЕЦ ИЗМЕНЕНИЙ ---
      }
      initialData={Promise.resolve(runtimeConfig)}
      readOnly
      language="yaml"
      schema="clash"
      onClose={() => setOpen(false)}
    />
  );
});
