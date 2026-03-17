import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
} from "react";
import { useLockFn } from "ahooks";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import {
  getConnections,
  providerHealthCheck,
  updateProxy,
  deleteConnection,
  getGroupProxyDelays,
} from "@/services/api";
import { useProfiles } from "@/hooks/use-profiles";
import { useVerge } from "@/hooks/use-verge";
import { BaseEmpty } from "../base";
import { useRenderList } from "./use-render-list";
import { ProxyRender } from "./proxy-render";
import delayManager from "@/services/delay";
import { useTranslation } from "react-i18next";
import { ScrollTopButton } from "../layout/scroll-top-button";

function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let previous = 0;

  return function (...args: Parameters<T>) {
    const now = Date.now();
    const remaining = wait - (now - previous);

    if (remaining <= 0 || remaining > wait) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      previous = now;
      func(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        previous = Date.now();
        timer = null;
        func(...args);
      }, remaining);
    }
  };
}

interface Props {
  mode: string;
}

// Основной компонент, обернутый в memo для производительности
export const ProxyGroups = memo((props: Props) => {
  const { t } = useTranslation();
  const { mode } = props;

  const { renderList, onProxies, onHeadState } = useRenderList(mode);
  const { verge } = useVerge();
  const { current, patchCurrent } = useProfiles();
  const timeout = verge?.default_latency_timeout || 10000;

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollerRef = useRef<Element | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Обработчик скролла для показа/скрытия кнопки "Наверх"
  const handleScroll = useCallback(
    throttle((e: any) => {
      setShowScrollTop(e.target.scrollTop > 100);
    }, 200),
    [],
  );

  // Добавление и удаление слушателя скролла
  useEffect(() => {
    const currentScroller = scrollerRef.current;
    if (currentScroller) {
      currentScroller.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      return () => {
        currentScroller.removeEventListener("scroll", handleScroll);
      };
    }
  }, [handleScroll]);

  const scrollToTop = useCallback(() => {
    virtuosoRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Вся бизнес-логика из оригинального файла
  const handleChangeProxy = useLockFn(
    async (group: IProxyGroupItem, proxy: IProxyItem) => {
      if (!["Selector", "URLTest", "Fallback"].includes(group.type)) return;

      const { name, now } = group;
      await updateProxy(name, proxy.name);
      onProxies();

      if (verge?.auto_close_connection) {
        getConnections().then(({ connections }) => {
          connections.forEach((conn) => {
            if (conn.chains.includes(now!)) {
              deleteConnection(conn.id);
            }
          });
        });
      }

      if (!current || !current.selected) return;
      const index = current.selected.findIndex(
        (item) => item.name === group.name,
      );

      if (index < 0) {
        current.selected.push({ name, now: proxy.name });
      } else {
        current.selected[index] = { name, now: proxy.name };
      }
      await patchCurrent({ selected: current.selected });
    },
  );

  const handleCheckAll = useLockFn(async (groupName: string) => {
    const proxies = renderList
      .filter(
        (e) => e.group?.name === groupName && (e.type === 2 || e.type === 4),
      )
      .flatMap((e) => e.proxyCol || e.proxy!)
      .filter(Boolean);

    const providers = new Set(proxies.map((p) => p!.provider!).filter(Boolean));

    if (providers.size) {
      Promise.allSettled(
        [...providers].map((p) => providerHealthCheck(p)),
      ).then(() => {
        onProxies();
      });
    }

    const names = proxies.filter((p) => !p!.provider).map((p) => p!.name);
    const url = delayManager.getUrl(groupName);

    try {
      await Promise.race([
        delayManager.checkListDelay(names, groupName, timeout),
        getGroupProxyDelays(groupName, url, timeout),
      ]);
    } catch (error) {
      console.error(
        `[ProxyGroups] Latency test error, group: ${groupName}`,
        error,
      );
    }
  });

  const handleLocation = (group: IProxyGroupItem) => {
    if (!group) return;
    const { name, now } = group;

    const index = renderList.findIndex(
      (e) =>
        e.group?.name === name &&
        ((e.type === 2 && e.proxy?.name === now) ||
          (e.type === 4 && e.proxyCol?.some((p) => p.name === now))),
    );

    if (index >= 0) {
      virtuosoRef.current?.scrollToIndex?.({
        index,
        align: "center",
        behavior: "smooth",
      });
    }
  };

  // Отображение заглушки для режима Direct
  if (mode === "direct") {
    return <BaseEmpty text={t("clash_mode_direct")} />;
  }

  return (
    <div className="relative h-full">
      <Virtuoso
        ref={virtuosoRef}
        style={{ height: "100%" }}
        data={renderList}
        scrollerRef={(ref) => (scrollerRef.current = ref as Element)}
        components={{ Footer: () => <div style={{ height: "8px" }} /> }}
        computeItemKey={(index) => renderList[index].key}
        itemContent={(index) => (
          <ProxyRender
            item={renderList[index]}
            indent={mode === "rule" || mode === "script"}
            onLocation={handleLocation}
            onCheckAll={handleCheckAll}
            onHeadState={onHeadState}
            onChangeProxy={handleChangeProxy}
          />
        )}
      />
      <ScrollTopButton show={showScrollTop} onClick={scrollToTop} />
    </div>
  );
});
