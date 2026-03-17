// ProxyRender.tsx

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { HeadState } from "./use-head-state";
import { ProxyHead } from "./proxy-head";
import { ProxyItem } from "./proxy-item";
import { ProxyItemMini } from "./proxy-item-mini";
import type { IRenderItem } from "./use-render-list";
import { useVerge } from "@/hooks/use-verge";

// Новые импорты из lucide-react и shadcn/ui
import { ChevronDown, ChevronUp, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RenderProps {
  item: IRenderItem;
  indent: boolean;
  onLocation: (group: IRenderItem["group"]) => void;
  onCheckAll: (groupName: string) => void;
  onHeadState: (groupName: string, patch: Partial<HeadState>) => void;
  onChangeProxy: (
    group: IRenderItem["group"],
    proxy: IRenderItem["proxy"] & { name: string },
  ) => void;
}

export const ProxyRender = (props: RenderProps) => {
  const { t } = useTranslation();
  const { indent, item, onLocation, onCheckAll, onHeadState, onChangeProxy } =
    props;
  const { type, group, headState, proxy, proxyCol } = item;
  const { verge } = useVerge();
  const enable_group_icon = verge?.enable_group_icon ?? true;
  // Логика с иконками остается, но ее нужно будет адаптировать, если она тоже использует MUI
  // В данном рефакторинге мы предполагаем, что иконки - это просто URL или SVG-строки

  // Рендер заголовка группы (type 0)
  if (type === 0) {
    return (
      <div
        className="flex items-center mx-2 my-1 p-3 rounded-lg bg-card hover:bg-accent cursor-pointer transition-colors border shadow-sm"
        onClick={() => onHeadState(group.name, { open: !headState?.open })}
      >
        {/* Логика иконок групп (сохранена) */}
        {enable_group_icon && group.icon && (
          <img
            src={
              group.icon.startsWith("data")
                ? group.icon
                : group.icon.startsWith("<svg")
                  ? `data:image/svg+xml;base64,${btoa(group.icon)}`
                  : group.icon
            }
            className="w-8 h-8 mr-3 rounded-md"
            alt={group.name}
          />
        )}

        {/* Основная текстовая часть */}
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold truncate">{group.name}</p>
          <div className="flex items-center text-xs text-muted-foreground mt-1">
            <Badge variant="outline" className="mr-2">
              {group.type}
            </Badge>
            <span className="truncate">{group.now}</span>
          </div>
        </div>

        {/* Правая часть с количеством и иконкой */}
        <div className="flex items-center ml-2">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="mr-2">
                  {group.all.length}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("Proxy Count")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {headState?.open ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </div>
      </div>
    );
  }

  // Рендер шапки с кнопками управления группой (type 1)
  // Компонент ProxyHead не меняем, только его контейнер
  if (type === 1) {
    return (
      <div className={indent ? "mt-1" : "mt-0.5"}>
        <ProxyHead
          url={group.testUrl}
          groupName={group.name}
          headState={headState!}
          onLocation={() => onLocation(group)}
          onCheckDelay={() => onCheckAll(group.name)}
          onHeadState={(p) => onHeadState(group.name, p)}
        />
      </div>
    );
  }

  // Рендер полного элемента прокси (type 2)
  // Компонент ProxyItem не меняем
  if (type === 2) {
    return (
      <ProxyItem
        group={group}
        proxy={proxy!}
        selected={group.now === proxy?.name}
        showType={headState?.showType}
        onClick={() => onChangeProxy(group, proxy!)}
      />
    );
  }

  // Рендер заглушки "No Proxies" (type 3)
  if (type === 3) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-muted-foreground">
        <Inbox className="w-12 h-12" />
        <p>No Proxies</p>
      </div>
    );
  }

  // Рендер сетки мини-прокси (type 4)
  if (type === 4) {
    const proxyColItemsMemo = useMemo(() => {
      return proxyCol?.map((p) => (
        <ProxyItemMini
          key={item.key + p.name}
          group={group}
          proxy={p}
          selected={group.now === p.name}
          showType={headState?.showType}
          onClick={() => onChangeProxy(group, p)}
        />
      ));
    }, [proxyCol, group, headState, item.key, onChangeProxy]);

    return (
      <div
        className="grid gap-2 p-2"
        style={{ gridTemplateColumns: `repeat(${item.col || 2}, 1fr)` }}
      >
        {proxyColItemsMemo}
      </div>
    );
  }

  return null;
};
