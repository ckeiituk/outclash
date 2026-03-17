import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { useAppData } from "@/providers/app-data-provider";
import { useVisibility } from "@/hooks/use-visibility";
import { cn } from "@root/lib/utils";

import { BaseEmpty } from "@/components/base";
import RuleItem from "@/components/rule/rule-item";
import { ProviderButton } from "@/components/rule/provider-button";
import { BaseSearchBox } from "@/components/base/base-search-box";
import { ScrollTopButton } from "@/components/layout/scroll-top-button";

import { SidebarTrigger } from "@/components/ui/sidebar";

const RulesPage = () => {
  const { t } = useTranslation();
  const { rules = [], refreshRules, refreshRuleProviders } = useAppData();
  const [match, setMatch] = useState(() => (_: string) => true);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pageVisible = useVisibility();

  useEffect(() => {
    refreshRules();
    refreshRuleProviders();
  }, []);

  useEffect(() => {
    if (pageVisible) {
      refreshRules();
      refreshRuleProviders();
    }
  }, [pageVisible]);

  const filteredRules = useMemo(() => {
    return rules.filter((item) => match(item.payload));
  }, [rules, match]);

  useEffect(() => {
    const currentScroller = scrollerRef.current;
    if (!currentScroller) return;
    const handleScroll = () => {
      const scrollTop = currentScroller.scrollTop;
      setIsScrolled(scrollTop > 5);
      setShowScrollTop(scrollTop > 100);
    };
    currentScroller.addEventListener("scroll", handleScroll);
    return () => currentScroller.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    virtuosoRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSearch = useCallback((matcher: (content: string) => boolean) => {
    setMatch(() => matcher);
  }, []);

  return (
    <div className="h-full w-full relative">
      <div
        className={cn(
          "absolute top-0 left-0 right-0 z-10 p-4 transition-all duration-200",
          { "bg-background/80 backdrop-blur-sm shadow-sm": isScrolled },
        )}
      >
        <div className="flex justify-between items-center">
          <div className="w-10">
            <SidebarTrigger />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("Rules")}
          </h2>
          <div className="flex items-center gap-2">
            <div className="w-70">
              <BaseSearchBox onSearch={handleSearch} />
            </div>
            <ProviderButton />
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="absolute top-0 left-0 right-0 bottom-0 pt-20 overflow-y-auto"
      >
        {filteredRules.length > 0 ? (
          <Virtuoso
            ref={virtuosoRef}
            data={filteredRules}
            className="h-full w-full"
            itemContent={(index, item) => (
              <RuleItem index={index + 1} value={item} />
            )}
          />
        ) : (
          <BaseEmpty />
        )}
      </div>
      <ScrollTopButton onClick={scrollToTop} show={showScrollTop} />
    </div>
  );
};

export default RulesPage;
