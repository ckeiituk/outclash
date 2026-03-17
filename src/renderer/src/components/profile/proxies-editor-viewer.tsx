import { ReactNode, useEffect, useMemo, useState, forwardRef } from "react";
import { useLockFn } from "ahooks";
import yaml from "js-yaml";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Virtuoso } from "react-virtuoso";
import MonacoEditor from "react-monaco-editor";

import { readProfileFile, saveProfileFile } from "@/services/cmds";
import getSystem from "@/utils/get-system";
import { useThemeMode } from "@/services/states";
import parseUri from "@/utils/uri-parser";
import { showNotice } from "@/services/noticeService";

// Компоненты
import { BaseSearchBox } from "../base/base-search-box";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

// Иконки
import {
  GripVertical,
  Trash2,
  Undo2,
  ArrowDownToLine,
  ArrowUpToLine,
} from "lucide-react";

interface Props {
  profileUid: string;
  property: string;
  open: boolean;
  onClose: () => void;
  onSave?: (prev?: string, curr?: string) => void;
}

// Новый, легковесный компонент для элемента списка, с поддержкой drag-and-drop
const EditorProxyItem = ({
  p_type,
  proxy,
  onDelete,
  id,
}: {
  p_type: string;
  proxy: IProxyConfig;
  onDelete: () => void;
  id: string;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : undefined,
  };

  const isDelete = p_type === "delete";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center p-2 mb-1 rounded-md bg-secondary"
      {...attributes}
    >
      <div
        {...listeners}
        className="cursor-grab p-1 text-muted-foreground hover:bg-accent rounded-sm"
      >
        <GripVertical className="h-5 w-5" />
      </div>
      <p
        className={`flex-1 truncate text-sm ${isDelete ? "line-through text-muted-foreground" : ""}`}
      >
        {proxy.name}
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onDelete}
      >
        {isDelete ? (
          <Undo2 className="h-4 w-4" />
        ) : (
          <Trash2 className="h-4 w-4 text-destructive" />
        )}
      </Button>
    </div>
  );
};

export const ProxiesEditorViewer = (props: Props) => {
  const { profileUid, property, open, onClose, onSave } = props;
  const { t } = useTranslation();
  const themeMode = useThemeMode();
  const [prevData, setPrevData] = useState("");
  const [currData, setCurrData] = useState("");
  const [visualization, setVisualization] = useState(true);
  const [match, setMatch] = useState(() => (_: string) => true);
  const [proxyUri, setProxyUri] = useState<string>("");

  const [proxyList, setProxyList] = useState<IProxyConfig[]>([]);
  const [prependSeq, setPrependSeq] = useState<IProxyConfig[]>([]);
  const [appendSeq, setAppendSeq] = useState<IProxyConfig[]>([]);
  const [deleteSeq, setDeleteSeq] = useState<string[]>([]);

  const filteredPrependSeq = useMemo(
    () => prependSeq.filter((proxy) => match(proxy.name)),
    [prependSeq, match],
  );
  const filteredProxyList = useMemo(
    () => proxyList.filter((proxy) => match(proxy.name)),
    [proxyList, match],
  );
  const filteredAppendSeq = useMemo(
    () => appendSeq.filter((proxy) => match(proxy.name)),
    [appendSeq, match],
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const reorder = (
    list: IProxyConfig[],
    startIndex: number,
    endIndex: number,
  ) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  };

  const onPrependDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      let activeIndex = 0;
      let overIndex = 0;
      prependSeq.forEach((item, index) => {
        if (item.name === active.id) activeIndex = index;
        if (item.name === over.id) overIndex = index;
      });
      setPrependSeq(reorder(prependSeq, activeIndex, overIndex));
    }
  };

  const onAppendDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      let activeIndex = 0;
      let overIndex = 0;
      appendSeq.forEach((item, index) => {
        if (item.name === active.id) activeIndex = index;
        if (item.name === over.id) overIndex = index;
      });
      setAppendSeq(reorder(appendSeq, activeIndex, overIndex));
    }
  };

  const handleParseAsync = (cb: (proxies: IProxyConfig[]) => void) => {
    let proxies: IProxyConfig[] = [];
    let names: string[] = [];
    let uris = "";
    try {
      uris = atob(proxyUri);
    } catch {
      uris = proxyUri;
    }
    const lines = uris.trim().split("\n");
    let idx = 0;
    const batchSize = 50;
    function parseBatch() {
      const end = Math.min(idx + batchSize, lines.length);
      for (; idx < end; idx++) {
        const uri = lines[idx];
        try {
          let proxy = parseUri(uri.trim());
          if (!names.includes(proxy.name)) {
            proxies.push(proxy);
            names.push(proxy.name);
          }
        } catch (err: any) {
          // Ignore parse errors
        }
      }
      if (idx < lines.length) {
        setTimeout(parseBatch, 0);
      } else {
        cb(proxies);
      }
    }
    parseBatch();
  };

  const fetchProfile = async () => {
    let data = await readProfileFile(profileUid);
    let originProxiesObj = yaml.load(data) as {
      proxies: IProxyConfig[];
    } | null;
    setProxyList(originProxiesObj?.proxies || []);
  };

  const fetchContent = async () => {
    let data = await readProfileFile(property);
    let obj = yaml.load(data) as ISeqProfileConfig | null;
    setPrependSeq(obj?.prepend || []);
    setAppendSeq(obj?.append || []);
    setDeleteSeq(obj?.delete || []);
    setPrevData(data);
    setCurrData(data);
  };

  useEffect(() => {
    if (currData === "" || visualization !== true) return;
    try {
      let obj = yaml.load(currData) as {
        prepend: [];
        append: [];
        delete: [];
      } | null;
      setPrependSeq(obj?.prepend || []);
      setAppendSeq(obj?.append || []);
      setDeleteSeq(obj?.delete || []);
    } catch (e) {
      console.error("Error parsing YAML in visualization mode:", e);
    }
  }, [visualization]);

  useEffect(() => {
    if (prependSeq && appendSeq && deleteSeq) {
      const serialize = () => {
        try {
          setCurrData(
            yaml.dump(
              { prepend: prependSeq, append: appendSeq, delete: deleteSeq },
              { forceQuotes: true },
            ),
          );
        } catch (e) {
          console.error("Error dumping YAML:", e);
        }
      };
      if (window.requestIdleCallback) {
        window.requestIdleCallback(serialize);
      } else {
        setTimeout(serialize, 0);
      }
    }
  }, [prependSeq, appendSeq, deleteSeq]);

  useEffect(() => {
    if (!open) return;
    fetchContent();
    fetchProfile();
  }, [open]);

  const handleSave = useLockFn(async () => {
    try {
      await saveProfileFile(property, currData);
      showNotice("success", t("Saved Successfully"));
      onSave?.(prevData, currData);
      onClose();
    } catch (err: any) {
      showNotice("error", err.toString());
    }
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="min-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex justify-between items-center pr-8">
            <DialogTitle>{t("Edit Proxies")}</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisualization((prev) => !prev)}
            >
              {visualization ? t("Advanced") : t("Visualization")}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {visualization ? (
            <div className="h-full flex gap-4">
              <div className="w-1/3 flex flex-col gap-4">
                <Textarea
                  placeholder={t("Use newlines for multiple uri")}
                  className="flex-1"
                  value={proxyUri}
                  onChange={(e) => setProxyUri(e.target.value)}
                />
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() =>
                      handleParseAsync((proxies) =>
                        setPrependSeq((prev) => [...proxies, ...prev]),
                      )
                    }
                  >
                    <ArrowUpToLine className="mr-2 h-4 w-4" />
                    {t("Prepend Proxy")}
                  </Button>
                  <Button
                    onClick={() =>
                      handleParseAsync((proxies) =>
                        setAppendSeq((prev) => [...prev, ...proxies]),
                      )
                    }
                  >
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    {t("Append Proxy")}
                  </Button>
                </div>
              </div>

              <Separator orientation="vertical" />

              <div className="w-2/3 flex flex-col">
                <BaseSearchBox
                  onSearch={(matcher) => setMatch(() => matcher)}
                />
                <div className="flex-1 min-h-0 mt-2 rounded-md border">
                  <Virtuoso
                    className="h-full"
                    totalCount={
                      filteredProxyList.length +
                      (filteredPrependSeq.length > 0 ? 1 : 0) +
                      (filteredAppendSeq.length > 0 ? 1 : 0)
                    }
                    itemContent={(index) => {
                      let shift = filteredPrependSeq.length > 0 ? 1 : 0;
                      if (filteredPrependSeq.length > 0 && index === 0) {
                        return (
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={onPrependDragEnd}
                          >
                            <SortableContext
                              items={filteredPrependSeq.map((x) => x.name)}
                            >
                              {filteredPrependSeq.map((item) => (
                                <EditorProxyItem
                                  key={item.name}
                                  id={item.name}
                                  p_type="prepend"
                                  proxy={item}
                                  onDelete={() =>
                                    setPrependSeq(
                                      prependSeq.filter(
                                        (v) => v.name !== item.name,
                                      ),
                                    )
                                  }
                                />
                              ))}
                            </SortableContext>
                          </DndContext>
                        );
                      } else if (index < filteredProxyList.length + shift) {
                        const newIndex = index - shift;
                        const currentProxy = filteredProxyList[newIndex];
                        return (
                          <EditorProxyItem
                            key={currentProxy.name}
                            id={currentProxy.name}
                            p_type={
                              deleteSeq.includes(currentProxy.name)
                                ? "delete"
                                : "original"
                            }
                            proxy={currentProxy}
                            onDelete={() => {
                              if (deleteSeq.includes(currentProxy.name)) {
                                setDeleteSeq(
                                  deleteSeq.filter(
                                    (v) => v !== currentProxy.name,
                                  ),
                                );
                              } else {
                                setDeleteSeq((prev) => [
                                  ...prev,
                                  currentProxy.name,
                                ]);
                              }
                            }}
                          />
                        );
                      } else {
                        return (
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={onAppendDragEnd}
                          >
                            <SortableContext
                              items={filteredAppendSeq.map((x) => x.name)}
                            >
                              {filteredAppendSeq.map((item) => (
                                <EditorProxyItem
                                  key={item.name}
                                  id={item.name}
                                  p_type="append"
                                  proxy={item}
                                  onDelete={() =>
                                    setAppendSeq(
                                      appendSeq.filter(
                                        (v) => v.name !== item.name,
                                      ),
                                    )
                                  }
                                />
                              ))}
                            </SortableContext>
                          </DndContext>
                        );
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full rounded-md border">
              <MonacoEditor
                height="100%"
                language="yaml"
                value={currData}
                theme={themeMode === "light" ? "vs" : "vs-dark"}
                options={{
                  tabSize: 2,
                  minimap: {
                    enabled: document.documentElement.clientWidth >= 1500,
                  },
                  mouseWheelZoom: true,
                  quickSuggestions: {
                    strings: true,
                    comments: true,
                    other: true,
                  },
                  padding: { top: 16 },
                  fontFamily: `Fira Code, JetBrains Mono, Roboto Mono, "Source Code Pro", Consolas, Menlo, Monaco, monospace, "Courier New", "Apple Color Emoji"${getSystem() === "windows" ? ", twemoji mozilla" : ""}`,
                  fontLigatures: false,
                  smoothScrolling: true,
                }}
                onChange={(value) => setCurrData(value)}
              />
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("Cancel")}
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave}>
            {t("Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
