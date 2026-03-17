import React, { useState } from "react";
import { useTranslation } from "react-i18next";

// Новые импорты
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, X, Trash2, Edit3, ExternalLink } from "lucide-react";

interface Props {
  value?: string;
  onlyEdit?: boolean;
  onChange: (value?: string) => void;
  onOpenUrl?: (value?: string) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}

// Новая функция для безопасного рендеринга URL с подсветкой
const HighlightedUrl = ({ url }: { url: string }) => {
  // Разбиваем строку по плейсхолдерам, сохраняя их в результате
  const parts = url.split(/(%host%|%port%|%secret%)/g);

  return (
    <p className="truncate text-sm" title={url}>
      {parts.map((part, index) =>
        part.startsWith("%") && part.endsWith("%") ? (
          <span key={index} className="font-semibold text-primary">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </p>
  );
};

export const WebUIItem = (props: Props) => {
  const {
    value,
    onlyEdit = false,
    onChange,
    onDelete,
    onOpenUrl,
    onCancel,
  } = props;

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const { t } = useTranslation();

  const handleSave = () => {
    onChange(editValue);
    setEditing(false);
  };

  const handleCancel = () => {
    onCancel?.();
    setEditing(false);
  };

  // --- Рендер режима редактирования ---
  if (editing || onlyEdit) {
    return (
      <div className="w-full">
        <div className="flex items-center gap-2 mt-1 mb-1">
          <Input
            autoFocus
            placeholder={t("Support %host, %port, %secret")}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" onClick={handleSave}>
                  <Check className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("Save")}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={handleCancel}>
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("Cancel")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {!onlyEdit && <Separator />}
      </div>
    );
  }

  // --- Рендер режима просмотра ---
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mt-1 mb-1 h-10">
        {" "}
        {/* h-10 для сохранения высоты */}
        <div className="flex-1 min-w-0">
          {value ? (
            <HighlightedUrl url={value} />
          ) : (
            <p className="text-sm text-muted-foreground">NULL</p>
          )}
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onOpenUrl?.(value)}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("Open URL")}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setEditing(true);
                  setEditValue(value);
                }}
              >
                <Edit3 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("Edit")}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("Delete")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Separator />
    </div>
  );
};
