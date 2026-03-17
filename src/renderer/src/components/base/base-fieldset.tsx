import React from "react";
import { cn } from "@root/lib/utils"; // Импортируем утилиту для объединения классов

type Props = {
  label: string;
  children?: React.ReactNode;
  className?: string; // Пропс для дополнительной стилизации
};

export const BaseFieldset: React.FC<Props> = (props) => {
  const { label, children, className } = props;

  return (
    // 1. Используем тег fieldset для семантики. Он позиционирован как relative.
    <fieldset
      className={cn(
        "relative rounded-md border border-border p-4", // Базовые стили
        className, // Дополнительные классы от пользователя
      )}
    >
      {/* 2. Используем legend. Он абсолютно спозиционирован относительно fieldset. */}
      <legend className="absolute -top-2.5 left-3 bg-background px-1 text-sm text-muted-foreground">
        {label}
      </legend>

      {/* 3. Здесь будет содержимое филдсета */}
      {children}
    </fieldset>
  );
};
