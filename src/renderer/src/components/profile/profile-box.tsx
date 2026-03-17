import * as React from "react";
import { cn } from "@root/lib/utils";

// Определяем пропсы: принимает все атрибуты для div и булевый пропс `selected`
export interface ProfileBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
}

export const ProfileBox = React.forwardRef<HTMLDivElement, ProfileBoxProps>(
  ({ className, selected, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        // Устанавливаем data-атрибут для стилизации выбранного состояния
        data-selected={selected}
        className={cn(
          // --- Базовые стили ---
          "relative block w-full cursor-pointer rounded-lg bg-card p-4 text-left text-muted-foreground transition-all duration-200",

          // --- Эффект рамки ---
          // По умолчанию рамка есть, но она прозрачная, чтобы резервировать место
          "border-l-4 border-transparent",
          // При выборе (`data-selected=true`) рамка окрашивается в основной цвет
          "data-[selected=true]:border-primary",

          // --- Эффект смены цвета текста ---
          // При выборе весь текст внутри становится более контрастным
          "data-[selected=true]:text-card-foreground",

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

ProfileBox.displayName = "ProfileBox";
