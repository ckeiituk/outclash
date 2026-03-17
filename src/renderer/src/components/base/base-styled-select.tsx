import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@root/lib/utils";

// Определяем новые пропсы для нашего компонента
export interface BaseStyledSelectProps {
  children: React.ReactNode; // Сюда будут передаваться <SelectItem>
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string; // для дополнительной стилизации
}

export const BaseStyledSelect: React.FC<BaseStyledSelectProps> = (props) => {
  const { value, onValueChange, placeholder, children, className } = props;

  return (
    // Используем композицию компонентов Select из shadcn/ui
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(
          "h-9 w-[180px]", // Задаем стандартные размеры, как у других селектов
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
};
