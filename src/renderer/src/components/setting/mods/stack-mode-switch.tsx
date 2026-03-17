import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

// Определяем возможные значения для TypeScript
type StackMode = "system" | "gvisor" | "mixed";

interface Props {
  value?: string;
  onChange?: (value: StackMode) => void;
}

export const StackModeSwitch = (props: Props) => {
  const { value, onChange } = props;
  const { t } = useTranslation();

  // Массив с опциями для удобного рендеринга
  const modes: StackMode[] = ["system", "gvisor", "mixed"];

  return (
    // Используем наш стандартный контейнер для создания группы кнопок
    <div className="flex items-center rounded-md border bg-muted p-0.5">
      {modes.map((mode) => (
        <Button
          key={mode}
          // Активная кнопка получает основной цвет темы
          variant={value?.toLowerCase() === mode ? "default" : "ghost"}
          onClick={() => onChange?.(mode)}
          size="sm"
          className="capitalize px-3 text-xs"
        >
          {/* Используем t() для возможной локализации в будущем */}
          {t(mode)}
        </Button>
      ))}
    </div>
  );
};
