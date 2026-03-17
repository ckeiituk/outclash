import useSWR from "swr";
import React, { useEffect } from "react";
import { useLockFn } from "ahooks";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { closeAllConnections, getClashConfig } from "@/services/api";
import { patchClashMode } from "@/services/cmds";
import { useVerge } from "@/hooks/use-verge";
import { ProxyGroups } from "@/components/proxy/proxy-groups";
import { ProviderButton } from "@/components/proxy/provider-button";
import { SidebarTrigger } from "@/components/ui/sidebar";

const ProxyPage = () => {
  const { t } = useTranslation();

  const { data: clashConfig, mutate: mutateClash } = useSWR(
    "getClashConfig",
    getClashConfig,
    {
      revalidateOnFocus: false,
      revalidateIfStale: true,
    },
  );

  const { verge } = useVerge();
  const modeList = ["rule", "global"];
  const curMode = clashConfig?.mode?.toLowerCase();

  const onChangeMode = useLockFn(async (mode: string) => {
    if (mode !== curMode && verge?.auto_close_connection) {
      closeAllConnections();
    }
    await patchClashMode(mode);
    mutateClash();
  });

  useEffect(() => {
    if (curMode && !modeList.includes(curMode)) {
      onChangeMode("rule");
    }
  }, [curMode]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 pb-2 flex justify-between items-center">
        <div className="w-10">
          <SidebarTrigger />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          {t("Proxies")}
        </h2>
        <div className="flex items-center space-x-2">
          <ProviderButton />
          <div className="flex items-center rounded-md border bg-muted p-0.5">
            {modeList.map((mode) => (
              <Button
                key={mode}
                variant={mode === curMode ? "default" : "ghost"}
                size="sm"
                onClick={() => onChangeMode(mode)}
                className="px-3 py-1 h-auto"
              >
                {t(mode)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        <ProxyGroups mode={curMode!} />
      </div>
    </div>
  );
};

export default ProxyPage;
