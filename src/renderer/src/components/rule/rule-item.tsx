// RuleItem.tsx

import { cn } from "@root/lib/utils"; // Импортируем утилиту для классов

// Массив CSS-классов для раскрашивания названий прокси
const PROXY_COLOR_CLASSES = [
  "text-sky-500",
  "text-violet-500",
  "text-amber-500",
  "text-lime-500",
  "text-emerald-500",
];

// Новая функция для получения CSS-класса цвета на основе названия
const getProxyColorClass = (proxyName: string): string => {
  if (proxyName === "REJECT" || proxyName === "REJECT-DROP") {
    return "text-destructive"; // Стандартный "опасный" цвет из shadcn
  }
  if (proxyName === "DIRECT") {
    return "text-primary"; // Стандартный основной цвет из shadcn
  }

  // Хеширующая функция для выбора случайного цвета из массива (логика сохранена)
  let sum = 0;
  for (let i = 0; i < proxyName.length; i++) {
    sum += proxyName.charCodeAt(i);
  }
  return PROXY_COLOR_CLASSES[sum % PROXY_COLOR_CLASSES.length];
};

interface Props {
  index: number;
  value: IRuleItem;
}

const RuleItem = (props: Props) => {
  const { index, value } = props;

  return (
    // Корневой элемент, стилизованный с помощью Tailwind
    <div className="flex p-3 border-b border-border">
      {/* Номер правила */}
      <p className="w-10 text-center text-sm text-muted-foreground mr-4 pt-0.5">
        {index}
      </p>

      {/* Основной контент */}
      <div className="flex-1">
        {/* Полезная нагрузка (условие правила) */}
        <p className="font-semibold text-sm break-all">
          {value.payload || "-"}
        </p>

        {/* Нижняя строка с типом правила и названием прокси */}
        <div className="flex items-center text-xs mt-1.5">
          <p className="text-muted-foreground w-32 mr-4">{value.type}</p>
          <p className={cn("font-medium", getProxyColorClass(value.proxy))}>
            {value.proxy}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RuleItem;
