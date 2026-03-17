import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@root/lib/utils";

// Новые импорты
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Trash2, Undo2 } from "lucide-react";

interface Props {
  type: "prepend" | "original" | "delete" | "append";
  proxy: IProxyConfig;
  onDelete: () => void;
}

// Определяем стили для каждого типа элемента
const typeStyles = {
  original: "bg-secondary/50",
  delete: "bg-destructive/20 text-muted-foreground line-through",
  prepend: "bg-green-500/20",
  append: "bg-green-500/20",
};

export const ProxyItem = (props: Props) => {
  const { type, proxy, onDelete } = props;

  // Drag-and-drop будет работать только для 'prepend' и 'append' типов
  const isSortable = type === "prepend" || type === "append";

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: proxy.name, disabled: !isSortable });

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

      {/* Название и тип прокси */}
      <div className="flex-1 min-w-0 ml-2">
        <p className="text-sm font-semibold truncate" title={proxy.name}>
          {proxy.name}
        </p>
        <div className="flex items-center text-xs text-muted-foreground mt-1">
          <Badge variant="outline">{proxy.type}</Badge>
        </div>
      </div>

      {/* Кнопка действия */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
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
