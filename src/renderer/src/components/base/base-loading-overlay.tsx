import React from "react";
import { BaseLoading } from "./base-loading"; // 1. Импортируем наш собственный компонент загрузки
import { cn } from "@root/lib/utils";

export interface BaseLoadingOverlayProps {
  isLoading: boolean;
  className?: string;
}

export const BaseLoadingOverlay: React.FC<BaseLoadingOverlayProps> = ({
  isLoading,
  className,
}) => {
  if (!isLoading) return null;

  return (
    // 2. Заменяем Box на div и переводим sx в классы Tailwind
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm",
        className,
      )}
    >
      {/* 3. Используем наш BaseLoading и делаем его немного больше */}
      <BaseLoading className="h-8 w-8 text-primary" />
    </div>
  );
};

export default BaseLoadingOverlay;
