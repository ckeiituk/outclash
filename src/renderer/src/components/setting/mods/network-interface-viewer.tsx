import { forwardRef, useImperativeHandle, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLockFn } from "ahooks";
import useSWR from "swr";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

// Новые импорты
import { getNetworkInterfacesInfo } from "@/services/cmds";
import { showNotice } from "@/services/noticeService";
import { DialogRef } from "@/components/base";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Copy } from "lucide-react";

// Дочерний компонент AddressDisplay (без изменений)
const AddressDisplay = (props: { label: string; content: string }) => {
  const { t } = useTranslation();
  const handleCopy = useLockFn(async () => {
    if (!props.content) return;
    await writeText(props.content);
    showNotice("success", t("Copy Success"));
  });

  return (
    <div className="flex justify-between items-center text-sm my-2">
      <p className="text-muted-foreground">{props.label}</p>
      <div className="flex items-center gap-2 rounded-md bg-muted px-2 py-1">
        <span className="font-mono">{props.content}</span>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCopy}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("Copy to clipboard")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export const NetworkInterfaceViewer = forwardRef<DialogRef>((props, ref) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isV4, setIsV4] = useState(true);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }));

  const { data: networkInterfaces } = useSWR(
    open ? "clash-verge-rev-internal://network-interfaces" : null,
    getNetworkInterfacesInfo,
    { fallbackData: [] },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex justify-between items-center pr-12">
            <DialogTitle>{t("Network Interface")}</DialogTitle>
            <div className="flex items-center rounded-md border bg-muted p-0.5">
              {/* --- НАЧАЛО ИЗМЕНЕНИЙ --- */}
              {/* Меняем `secondary` на `default` для активной кнопки */}
              <Button
                variant={isV4 ? "default" : "ghost"}
                size="sm"
                className="px-3 text-xs"
                onClick={() => setIsV4(true)}
              >
                IPv4
              </Button>
              <Button
                variant={!isV4 ? "default" : "ghost"}
                size="sm"
                className="px-3 text-xs"
                onClick={() => setIsV4(false)}
              >
                IPv6
              </Button>
              {/* --- КОНЕЦ ИЗМЕНЕНИЙ --- */}
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
          {networkInterfaces?.map((item, index) => (
            <div key={item.name} className="py-2">
              <h4 className="font-semibold text-base mb-1">{item.name}</h4>
              <div>
                {isV4 ? (
                  <>
                    {item.addr.map(
                      (address) =>
                        address.V4 && (
                          <AddressDisplay
                            key={address.V4.ip}
                            label={t("Ip Address")}
                            content={address.V4.ip}
                          />
                        ),
                    )}
                    <AddressDisplay
                      label={t("Mac Address")}
                      content={item.mac_addr ?? ""}
                    />
                  </>
                ) : (
                  <>
                    {item.addr.map(
                      (address) =>
                        address.V6 && (
                          <AddressDisplay
                            key={address.V6.ip}
                            label={t("Ip Address")}
                            content={address.V6.ip}
                          />
                        ),
                    )}
                    <AddressDisplay
                      label={t("Mac Address")}
                      content={item.mac_addr ?? ""}
                    />
                  </>
                )}
              </div>
              {index < networkInterfaces.length - 1 && (
                <Separator className="mt-2" />
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("Close")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
