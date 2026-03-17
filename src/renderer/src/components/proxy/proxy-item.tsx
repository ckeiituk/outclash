// ProxyItem.tsx

import { useEffect, useState } from "react";
import { useLockFn } from "ahooks";
import { useVerge } from "@/hooks/use-verge";
import delayManager from "@/services/delay";

// Новые импорты
import { CheckCircle2, RefreshCw } from "lucide-react";
import { BaseLoading } from "@/components/base";
import { Badge } from "@/components/ui/badge";

interface Props {
  group: IProxyGroupItem;
  proxy: IProxyItem;
  selected: boolean;
  showType?: boolean;
  onClick?: (name: string) => void;
}

// Вспомогательная функция для определения цвета задержки
const getDelayColorClass = (delay: number): string => {
  if (delay < 0 || delay >= 10000) return "text-destructive";
  if (delay >= 500) return "text-destructive";
  if (delay >= 200) return "text-yellow-500";
  return "text-green-500";
};

export const ProxyItem = (props: Props) => {
  const { group, proxy, selected, showType = true, onClick } = props;

  const presetList = ["DIRECT", "REJECT", "REJECT-DROP", "PASS", "COMPATIBLE"];
  const isPreset = presetList.includes(proxy.name);

  const [delay, setDelay] = useState(-1);
  const { verge } = useVerge();
  const timeout = verge?.default_latency_timeout || 10000;

  // Вся логика хуков остается без изменений
  useEffect(() => {
    if (isPreset) return;
    delayManager.setListener(proxy.name, group.name, setDelay);
    return () => {
      delayManager.removeListener(proxy.name, group.name);
    };
  }, [proxy.name, group.name, isPreset]);

  useEffect(() => {
    if (!proxy) return;
    setDelay(delayManager.getDelayFix(proxy, group.name));
  }, [proxy, group.name]);

  const onDelay = useLockFn(async () => {
    setDelay(-2); // -2 это состояние загрузки
    const newDelay = await delayManager.checkDelay(
      proxy.name,
      group.name,
      timeout,
    );
    setDelay(newDelay);
  });

  const handleItemClick = () => {
    if (onClick) {
      onClick(proxy.name);
    }
  };

  const handleDelayClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Останавливаем всплытие, чтобы не сработал клик по всей строке
    if (!proxy.provider) {
      onDelay();
    }
  };

  return (
    // 1. Основной контейнер. Добавляем `group` для hover-эффектов на дочерних элементах.
    // Атрибут data-selected используется для стилизации выделенного элемента.
    <div
      data-selected={selected}
      onClick={handleItemClick}
      className="group mx-2 mb-1 flex cursor-pointer items-center rounded-lg border bg-card p-3 transition-all duration-200 hover:shadow-md data-[selected=true]:ring-2 data-[selected=true]:ring-primary"
    >
      {/* Левая часть с названием и тегами */}
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-sm">{proxy.name}</p>
        {showType && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {!!proxy.provider && (
              <Badge variant="outline">{proxy.provider}</Badge>
            )}
            <Badge variant="outline">{proxy.type}</Badge>
            {proxy.udp && <Badge variant="outline">UDP</Badge>}
            {proxy.xudp && <Badge variant="outline">XUDP</Badge>}
            {proxy.tfo && <Badge variant="outline">TFO</Badge>}
            {proxy.mptcp && <Badge variant="outline">MPTCP</Badge>}
            {proxy.smux && <Badge variant="outline">SMUX</Badge>}
          </div>
        )}
      </div>

      {/* Правая часть с индикатором задержки */}
      <div className="ml-4 flex h-6 w-20 items-center justify-end text-sm">
        {isPreset ? null : delay === -2 ? ( // Состояние загрузки
          <div className="flex items-center text-muted-foreground">
            <BaseLoading className="w-4 h-4" />
          </div>
        ) : delay > 0 ? ( // Состояние с задержкой
          <div
            onClick={handleDelayClick}
            className={`font-medium ${getDelayColorClass(delay)} ${!proxy.provider ? "hover:opacity-70" : "cursor-default"}`}
          >
            {delayManager.formatDelay(delay, timeout)}
          </div>
        ) : (
          // Состояние по умолчанию (до проверки)
          <>
            {selected && (
              <CheckCircle2 className="h-5 w-5 text-primary group-hover:hidden" />
            )}
            {!selected && !proxy.provider && (
              <div
                onClick={handleDelayClick}
                className="hidden h-full w-full items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 group-hover:flex"
              >
                <RefreshCw className="h-4 w-4" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
