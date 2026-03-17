import * as React from "react";
import { cn } from "@root/lib/utils"; // Утилита для объединения классов

// Определяем пропсы для нашего компонента.
// Он принимает все стандартные атрибуты для div, а также `selected`.
export interface TestBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
}

export const TestBox = React.forwardRef<HTMLDivElement, TestBoxProps>(
  ({ className, selected, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        // Устанавливаем data-атрибут в зависимости от пропса `selected`
        data-selected={selected}
        // Объединяем классы для создания сложной стилизации
        className={cn(
          // --- Базовые стили ---
          "relative w-full cursor-pointer rounded-lg p-4 shadow-sm transition-all duration-200",

          // --- Стили по умолчанию (не выбран) ---
          "bg-primary/5 text-muted-foreground",
          "hover:bg-primary/10 hover:shadow-md",

          // --- Стили для ВЫБРАННОГО состояния ---
          // Используем data-атрибут для стилизации
          "data-[selected=true]:bg-primary/20 data-[selected=true]:text-primary data-[selected=true]:shadow-lg",

          // --- Дополнительные классы от пользователя ---
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

TestBox.displayName = "TestBox";
