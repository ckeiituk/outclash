import React, { ReactNode } from "react";
import { BaseErrorBoundary } from "./base-error-boundary";
import { cn } from "@root/lib/utils";

interface Props {
  title?: ReactNode; // Заголовок страницы
  header?: ReactNode; // Элементы в правой части шапки (кнопки и т.д.)
  children?: ReactNode; // Основное содержимое страницы
  className?: string; // Дополнительные классы для основной области контента
}

export const BasePage: React.FC<Props> = (props) => {
  const { title, header, children, className } = props;

  return (
    <BaseErrorBoundary>
      {/* 1. Корневой контейнер: flex-колонка на всю высоту */}
      <div className="h-full flex flex-col bg-background text-foreground">
        {/* 2. Шапка: не растягивается, имеет фиксированную высоту и нижнюю границу */}
        <header
          data-tauri-drag-region="true"
          className="flex-shrink-0 flex items-center justify-between h-16 px-4 border-b border-border"
        >
          <h2 className="text-xl font-bold" data-tauri-drag-region="true">
            {title}
          </h2>
          <div data-tauri-drag-region="true">{header}</div>
        </header>

        {/* 3. Основная область: занимает все оставшееся место и прокручивается */}
        <main className={cn("flex-1 overflow-y-auto min-h-0", className)}>
          {children}
        </main>
      </div>
    </BaseErrorBoundary>
  );
};
