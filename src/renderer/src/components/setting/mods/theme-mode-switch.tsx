import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

type ThemeValue = "light" | "dark" | "system";

interface Props {
  value?: ThemeValue;
  onChange?: (value: ThemeValue) => void;
}

export const ThemeModeSwitch = (props: Props) => {
  const { value, onChange } = props;
  const { t } = useTranslation();

  const modes: ThemeValue[] = ["light", "dark", "system"];

  return (
    <div className="flex items-center rounded-md border bg-muted p-0.5">
      {modes.map((mode) => (
        <Button
          key={mode}
          variant={mode === value ? "default" : "ghost"}
          onClick={() => onChange?.(mode)}
          size="sm"
          className="capitalize px-3 text-xs"
        >
          {t(`theme.${mode}`)}
        </Button>
      ))}
    </div>
  );
};
