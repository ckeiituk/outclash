import React, { useRef, useState } from "react";
import { useLockFn } from "ahooks";
import { useTranslation } from "react-i18next";

// Новые импорты
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Используем Input для консистентности
import { Loader2 } from "lucide-react"; // Иконка для спиннера

interface Props {
  onChange: (file: File, value: string) => void;
}

export const FileInput: React.FC<Props> = (props) => {
  const { onChange } = props;
  const { t } = useTranslation();

  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");

  // Вся ваша логика для чтения файла остается без изменений
  const onFileInput = useLockFn(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);
      setLoading(true);

      try {
        const value = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            resolve(event.target?.result as string);
          };
          reader.onerror = (err) => reject(err);
          reader.readAsText(file);
        });
        onChange(file, value);
      } catch (error) {
        console.error("File reading error:", error);
      } finally {
        setLoading(false);
        // Очищаем value у input, чтобы можно было выбрать тот же файл еще раз
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      }
    },
  );

  return (
    // Заменяем Box на div с flex и gap для отступов
    <div className="flex items-center gap-4 my-4">
      <Button
        type="button" // Явно указываем тип, чтобы избежать отправки формы
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
      >
        {t("Choose File")}
      </Button>

      {/* Сам input остается скрытым */}
      <Input
        type="file"
        accept=".yaml,.yml"
        ref={inputRef}
        className="hidden"
        onChange={onFileInput}
      />

      {/* Область для отображения имени файла или статуса загрузки */}
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <p className="truncate" title={fileName}>
          {loading ? t("Loading...") : fileName || t("No file selected")}
        </p>
      </div>
    </div>
  );
};
