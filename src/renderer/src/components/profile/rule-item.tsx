import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@root/lib/utils";

// Новые импорты
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Trash2, Undo2 } from "lucide-react";

interface Props {
  type: "prepend" | "original" | "delete" | "append";
  ruleRaw: string;
  onDelete: () => void;
}

// Определяем стили для каждого типа элемента
const typeStyles = {
  original: "bg-secondary/50",
  delete: "bg-destructive/20 text-muted-foreground line-through",
  prepend: "bg-green-500/20",
  append: "bg-green-500/20",
};

// Вспомогательная функция для цвета политики прокси
const PROXY_COLOR_CLASSES = [
  "text-sky-500",
  "text-violet-500",
  "text-amber-500",
  "text-lime-500",
  "text-emerald-500",
];
const getProxyColorClass = (proxyName: string): string => {
  if (proxyName === "REJECT" || proxyName === "REJECT-DROP")
    return "text-destructive";
  if (proxyName === "DIRECT") return "text-primary";
  let sum = 0;
  for (let i = 0; i < proxyName.length; i++) sum += proxyName.charCodeAt(i);
  return PROXY_COLOR_CLASSES[sum % PROXY_COLOR_CLASSES.length];
};

export const RuleItem = (props: Props) => {
  const { type, ruleRaw, onDelete } = props;

  // Drag-and-drop будет работать только для 'prepend' и 'append' типов
  const isSortable = type === "prepend" || type === "append";

  // Логика парсинга строки правила остается без изменений
  const rule = ruleRaw.replace(",no-resolve", "");
  const ruleType = rule.match(/^[^,]+/)?.[0] ?? "";
  const proxyPolicy = rule.match(/[^,]+$/)?.[0] ?? "";
  const ruleContent = rule.slice(ruleType.length + 1, -proxyPolicy.length - 1);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ruleRaw, disabled: !isSortable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      // Применяем условные стили
      className={cn(
        "flex items-center p-2 mb-1 rounded-lg transition-shadow",
        typeStyles[type],
        isDragging && "shadow-lg",
      )}
    >
      {/* Ручка для перетаскивания */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "p-1 text-muted-foreground rounded-sm",
          isSortable ? "cursor-move hover:bg-accent" : "cursor-default",
        )}
      >
        <GripVertical className="h-5 w-5" />
      </div>

      {/* Основной контент */}
      <div className="flex-1 min-w-0 ml-2">
        <p
          className="text-sm font-semibold truncate"
          title={ruleContent || "-"}
        >
          {ruleContent || "-"}
        </p>
        <div className="flex items-center justify-between text-xs mt-1">
          <Badge variant="outline">{ruleType}</Badge>
          <p className={cn("font-medium", getProxyColorClass(proxyPolicy))}>
            {proxyPolicy}
          </p>
        </div>
      </div>

      {/* Кнопка действия */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 ml-2"
        onClick={onDelete}
      >
        {type === "delete" ? (
          <Undo2 className="h-4 w-4" />
        ) : (
          <Trash2 className="h-4 w-4 text-destructive" />
        )}
      </Button>
    </div>
  );
};
