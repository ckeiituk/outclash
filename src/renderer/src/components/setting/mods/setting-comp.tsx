import React, { ReactNode, useState } from "react";
import isAsyncFunction from "@/utils/is-async-function";
import { cn } from "@root/lib/utils";

// Новые импорты
import { Loader2, ChevronRight } from "lucide-react";

// --- Новый компонент SettingList ---
interface ListProps {
  title: string;
  children: ReactNode;
}

export const SettingList: React.FC<ListProps> = ({ title, children }) => (
  <div>
    <h3 className="text-lg font-medium mb-4 px-1">{title}</h3>
    <div className="flex flex-col">{children}</div>
  </div>
);

// --- Новый компонент SettingItem ---
interface ItemProps {
  label: ReactNode;
  extra?: ReactNode; // Для иконок-подсказок рядом с лейблом
  children?: ReactNode; // Для элементов управления (Switch, Select и т.д.)
  secondary?: ReactNode; // Для текста-описания под лейблом
  onClick?: () => void | Promise<any>;
}

export const SettingItem: React.FC<ItemProps> = (props) => {
  const { label, extra, children, secondary, onClick } = props;
  const clickable = !!onClick;

  const [isLoading, setIsLoading] = useState(false);

  const handleClick = () => {
    if (onClick) {
      // Если onClick - асинхронная функция, показываем спиннер
      if (isAsyncFunction(onClick)) {
        setIsLoading(true);
        onClick()!.finally(() => setIsLoading(false));
      } else {
        onClick();
      }
    }
  };

  return (
    <div
      onClick={clickable ? handleClick : undefined}
      className={cn(
        "flex items-center justify-between py-4 border-b border-border last:border-b-0",
        clickable && "cursor-pointer hover:bg-accent/50 -mx-4 px-4",
        isLoading && "cursor-default opacity-70",
      )}
    >
      {/* Левая часть: заголовок и описание */}
      <div className="flex flex-col gap-1 pr-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{label}</p>
          {extra}
        </div>
        {secondary && (
          <p className="text-sm text-muted-foreground">{secondary}</p>
        )}
      </div>

      {/* Правая часть: элемент управления или иконка */}
      <div className="flex-shrink-0">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : clickable ? (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        ) : (
          children
        )}
      </div>
    </div>
  );
};
