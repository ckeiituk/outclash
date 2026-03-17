import { Loader2 } from "lucide-react"; // 1. Импортируем стандартную иконку загрузки
import { cn } from "@root/lib/utils"; // Утилита для объединения классов

interface Props {
  className?: string;
}

export const BaseLoading: React.FC<Props> = ({ className }) => {
  return (
    // 2. Используем иконку с анимацией вращения от Tailwind
    // Мы можем легко менять ее размер и цвет через className
    <Loader2 className={cn("h-5 w-5 animate-spin", className)} />
  );
};
