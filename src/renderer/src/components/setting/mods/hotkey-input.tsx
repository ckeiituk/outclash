import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { parseHotkey } from "@/utils/parse-hotkey";
import { cn } from "@root/lib/utils";

// Новые импорты
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
}

export const HotkeyInput = (props: Props) => {
  const { value, onChange } = props;
  const { t } = useTranslation();

  const changeRef = useRef<string[]>([]);
  const [keys, setKeys] = useState(value);

  const handleKeyUp = () => {
    const ret = changeRef.current.slice();
    if (ret.length) {
      onChange(ret);
      changeRef.current = [];
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // --- НАЧАЛО ИСПРАВЛЕНИЯ ---
    // Передаем e.key (строку), а не e.nativeEvent (объект)
    const key = parseHotkey(e.key);
    // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

    if (key === "UNIDENTIFIED") return;

    changeRef.current = [...new Set([...changeRef.current, key])];
    setKeys(changeRef.current);
  };

  const handleClear = () => {
    onChange([]);
    setKeys([]);
    changeRef.current = [];
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative rounded-md ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <Input
          readOnly
          onKeyUp={handleKeyUp}
          onKeyDown={handleKeyDown}
          className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
        />
        <div className="flex min-h-9 w-48 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
          {keys && keys.length > 0 ? (
            keys.map((key) => (
              <Badge key={key} variant="secondary">
                {key}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground">{t("Press any key")}</span>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title={t("Delete")}
        onClick={handleClear}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
