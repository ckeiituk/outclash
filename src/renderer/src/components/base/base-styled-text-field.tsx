import * as React from "react"; // 1. Убедимся, что React импортирован
import { useTranslation } from "react-i18next";
import { cn } from "@root/lib/utils";
import { Input } from "@/components/ui/input"; // 2. Убираем импорт несуществующего типа InputProps

// 3. Определяем наши пропсы, расширяя стандартный тип для input-элементов из React
export interface BaseStyledTextFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const BaseStyledTextField = React.forwardRef<
  HTMLInputElement,
  BaseStyledTextFieldProps // Используем наш правильный тип
>((props, ref) => {
  const { t } = useTranslation();
  const { className, ...restProps } = props;

  return (
    <Input
      ref={ref}
      className={cn(
        "h-9", // Задаем стандартную компактную высоту
        className,
      )}
      placeholder={props.placeholder ?? t("Filter conditions")}
      autoComplete="off"
      spellCheck="false"
      {...restProps}
    />
  );
});

BaseStyledTextField.displayName = "BaseStyledTextField";
