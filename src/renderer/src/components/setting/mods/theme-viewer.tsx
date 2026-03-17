import {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useLockFn } from "ahooks";
import { useTranslation } from "react-i18next";

import { useVerge } from "@/hooks/use-verge";
import { defaultTheme, defaultDarkTheme } from "@/pages/_theme";
import { DialogRef } from "@/components/base";
import { EditorViewer } from "@/components/profile/editor-viewer";
import { showNotice } from "@/services/noticeService";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit } from "lucide-react";
import { useThemeMode } from "@/services/states"; // Наш хук для получения текущего режима
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { HexColorPicker } from "react-colorful";

interface Props {}

const ColorSettingRow = ({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (e: { target: { value: string } }) => void; // Адаптируем тип для совместимости
}) => {
  const color = value || placeholder;

  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-8 w-8 p-0 border-2"
              style={{ backgroundColor: color }}
              aria-label={`Choose ${label}`}
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-0">
            <HexColorPicker
              color={color}
              onChange={(newColor) => onChange({ target: { value: newColor } })}
            />
          </PopoverContent>
        </Popover>
        <Input
          className="w-32 h-8 font-mono text-sm"
          value={value ?? ""}
          placeholder={placeholder}
          onChange={onChange}
        />
      </div>
    </div>
  );
};

export const ThemeViewer = forwardRef<DialogRef>((props, ref) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const { verge, patchVerge, mutateVerge } = useVerge();
  const { theme_setting } = verge ?? {};
  const [theme, setTheme] = useState(theme_setting || {});

  const mode = useThemeMode();
  const resolvedMode =
    mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode;

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      setTheme({ ...theme_setting });
    },
    close: () => setOpen(false),
  }));

  const handleChange =
    (field: keyof typeof theme) => (e: { target: { value: string } }) => {
      setTheme((t) => ({ ...t, [field]: e.target.value }));
    };

  const onSave = useLockFn(async () => {
    try {
      await patchVerge({ theme_setting: theme });
      await mutateVerge();
      setOpen(false);
      showNotice("success", t("Theme updated successfully"));
    } catch (err: any) {
      showNotice("error", err.toString());
    }
  });

  const dt = resolvedMode === "light" ? defaultTheme : defaultDarkTheme;
  type ThemeKey = keyof typeof theme & keyof typeof defaultTheme;

  const renderItem = (label: string, key: ThemeKey) => {
    return (
      <ColorSettingRow
        label={label}
        value={theme[key] ?? ""}
        placeholder={dt[key]}
        onChange={handleChange(key)}
      />
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Theme Setting")}</DialogTitle>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto space-y-3 p-1">
            {renderItem(t("Primary Color"), "primary_color")}
            {renderItem(t("Secondary Color"), "secondary_color")}
            {renderItem(t("Primary Text"), "primary_text")}
            {renderItem(t("Secondary Text"), "secondary_text")}
            {renderItem(t("Info Color"), "info_color")}
            {renderItem(t("Warning Color"), "warning_color")}
            {renderItem(t("Error Color"), "error_color")}
            {renderItem(t("Success Color"), "success_color")}

            <div className="flex items-center justify-between py-2">
              <Label>{t("Font Family")}</Label>
              <Input
                className="w-48 h-8"
                value={theme.font_family ?? ""}
                onChange={handleChange("font_family")}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <Label>{t("CSS Injection")}</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditorOpen(true)}
              >
                <Edit className="mr-2 h-4 w-4" />
                {t("Edit")} CSS
              </Button>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("Cancel")}
              </Button>
            </DialogClose>
            <Button type="button" onClick={onSave}>
              {t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editorOpen && (
        <EditorViewer
          open={true}
          title={`${t("Edit")} CSS`}
          initialData={Promise.resolve(theme.css_injection ?? "")}
          language="css"
          onSave={(_prev, curr) => {
            setTheme((v) => ({ ...v, css_injection: curr }));
          }}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </>
  );
});
