import { ReactNode, useEffect, useMemo, useState } from "react";
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
import { showNotice } from "@/services/noticeService";
import { BaseSearchBox } from "../base/base-search-box";

// Компоненты shadcn/ui
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// Иконки
import {
  Check,
  ChevronsUpDown,
  GripVertical,
  Trash2,
  Undo2,
  ArrowDownToLine,
  ArrowUpToLine,
} from "lucide-react";
import { cn } from "@root/lib/utils";

// --- Вспомогательные функции, константы и валидаторы ---
const portValidator = (value: string): boolean =>
  /^(?:[1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/.test(
    value,
  );
const ipv4CIDRValidator = (value: string): boolean =>
  /^(?:(?:[1-9]?[0-9]|1[0-9][0-9]|2(?:[0-4][0-9]|5[0-5]))\.){3}(?:[1-9]?[0-9]|1[0-9][0-9]|2(?:[0-4][0-9]|5[0-5]))(?:\/(?:[12]?[0-9]|3[0-2]))?$/.test(
    value,
  );
const ipv6CIDRValidator = (value: string): boolean =>
  /^([0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){7}|::|:(?::[0-9a-fA-F]{1,4}){1,6}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,5}|(?:[0-9a-fA-F]{1,4}:){2}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){3}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){4}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){5}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,6}:)\/(?:12[0-8]|1[01][0-9]|[1-9]?[0-9])$/.test(
    value,
  );

const rules: {
  name: string;
  required?: boolean;
  example?: string;
  noResolve?: boolean;
  validator?: (value: string) => boolean;
}[] = [
  { name: "DOMAIN", example: "example.com" },
  { name: "DOMAIN-SUFFIX", example: "example.com" },
  { name: "DOMAIN-KEYWORD", example: "example" },
  { name: "DOMAIN-REGEX", example: "example.*" },
  { name: "GEOSITE", example: "youtube" },
  { name: "GEOIP", example: "CN", noResolve: true },
  { name: "SRC-GEOIP", example: "CN" },
  {
    name: "IP-ASN",
    example: "13335",
    noResolve: true,
    validator: (value) => (+value ? true : false),
  },
  {
    name: "SRC-IP-ASN",
    example: "9808",
    validator: (value) => (+value ? true : false),
  },
  {
    name: "IP-CIDR",
    example: "127.0.0.0/8",
    noResolve: true,
    validator: (value) => ipv4CIDRValidator(value) || ipv6CIDRValidator(value),
  },
  {
    name: "IP-CIDR6",
    example: "2620:0:2d0:200::7/32",
    noResolve: true,
    validator: (value) => ipv4CIDRValidator(value) || ipv6CIDRValidator(value),
  },
  {
    name: "SRC-IP-CIDR",
    example: "192.168.1.201/32",
    validator: (value) => ipv4CIDRValidator(value) || ipv6CIDRValidator(value),
  },
  {
    name: "IP-SUFFIX",
    example: "8.8.8.8/24",
    noResolve: true,
    validator: (value) => ipv4CIDRValidator(value) || ipv6CIDRValidator(value),
  },
  {
    name: "SRC-IP-SUFFIX",
    example: "192.168.1.201/8",
    validator: (value) => ipv4CIDRValidator(value) || ipv6CIDRValidator(value),
  },
  {
    name: "SRC-PORT",
    example: "7777",
    validator: (value) => portValidator(value),
  },
  {
    name: "DST-PORT",
    example: "80",
    validator: (value) => portValidator(value),
  },
  {
    name: "IN-PORT",
    example: "7890",
    validator: (value) => portValidator(value),
  },
  { name: "DSCP", example: "4" },
  {
    name: "PROCESS-NAME",
    example: getSystem() === "windows" ? "chrome.exe" : "curl",
  },
  {
    name: "PROCESS-PATH",
    example:
      getSystem() === "windows"
        ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        : "/usr/bin/wget",
  },
  { name: "PROCESS-NAME-REGEX", example: ".*telegram.*" },
  {
    name: "PROCESS-PATH-REGEX",
    example:
      getSystem() === "windows" ? "(?i).*Application\\chrome.*" : ".*bin/wget",
  },
  {
    name: "NETWORK",
    example: "udp",
    validator: (value) => ["tcp", "udp"].includes(value),
  },
  {
    name: "UID",
    example: "1001",
    validator: (value) => (+value ? true : false),
  },
  { name: "IN-TYPE", example: "SOCKS/HTTP" },
  { name: "IN-USER", example: "mihomo" },
  { name: "IN-NAME", example: "ss" },
  { name: "SUB-RULE", example: "(NETWORK,tcp)" },
  { name: "RULE-SET", example: "providername", noResolve: true },
  { name: "AND", example: "((DOMAIN,baidu.com),(NETWORK,UDP))" },
  { name: "OR", example: "((NETWORK,UDP),(DOMAIN,baidu.com))" },
  { name: "NOT", example: "((DOMAIN,baidu.com))" },
  { name: "MATCH", required: false },
];
const builtinProxyPolicies = ["DIRECT", "REJECT", "REJECT-DROP", "PASS"];

const Combobox = ({
  options,
  value,
  onSelect,
  placeholder,
}: {
  options: string[];
  value: string;
  onSelect: (value: string) => void;
  placeholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value || placeholder || "Select..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandList>
            {options.map((option) => (
              <CommandItem
                key={option}
                value={option}
                onSelect={() => {
                  onSelect(option);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === option ? "opacity-100" : "opacity-0",
                  )}
                />
                {option}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// --- Компонент для элемента списка правил ---
const EditorRuleItem = ({
  type,
  ruleRaw,
  onDelete,
  id,
}: {
  type: string;
  ruleRaw: string;
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
  const isDelete = type === "delete";
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
        {ruleRaw}
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

interface Props {
  groupsUid: string;
  mergeUid: string;
  profileUid: string;
  property: string;
  open: boolean;
  onClose: () => void;
  onSave?: (prev?: string, curr?: string) => void;
}

export const RulesEditorViewer = (props: Props) => {
  const { groupsUid, mergeUid, profileUid, property, open, onClose, onSave } =
    props;
  const { t } = useTranslation();
  const themeMode = useThemeMode();

  const [prevData, setPrevData] = useState("");
  const [currData, setCurrData] = useState("");
  const [visualization, setVisualization] = useState(true);
  const [match, setMatch] = useState(() => (_: string) => true);
  const [ruleType, setRuleType] = useState<(typeof rules)[number]>(rules[0]);
  const [ruleContent, setRuleContent] = useState("");
  const [noResolve, setNoResolve] = useState(false);
  const [proxyPolicy, setProxyPolicy] = useState(builtinProxyPolicies[0]);
  const [proxyPolicyList, setProxyPolicyList] = useState<string[]>([]);
  const [ruleList, setRuleList] = useState<string[]>([]);
  const [ruleSetList, setRuleSetList] = useState<string[]>([]);
  const [subRuleList, setSubRuleList] = useState<string[]>([]);
  const [prependSeq, setPrependSeq] = useState<string[]>([]);
  const [appendSeq, setAppendSeq] = useState<string[]>([]);
  const [deleteSeq, setDeleteSeq] = useState<string[]>([]);

  const filteredPrependSeq = useMemo(
    () => prependSeq.filter((rule) => match(rule)),
    [prependSeq, match],
  );
  const filteredRuleList = useMemo(
    () => ruleList.filter((rule) => match(rule)),
    [ruleList, match],
  );
  const filteredAppendSeq = useMemo(
    () => appendSeq.filter((rule) => match(rule)),
    [appendSeq, match],
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const reorder = (list: string[], startIndex: number, endIndex: number) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  };
  const onPrependDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      let activeIndex = prependSeq.indexOf(active.id.toString());
      let overIndex = prependSeq.indexOf(over.id.toString());
      setPrependSeq(reorder(prependSeq, activeIndex, overIndex));
    }
  };
  const onAppendDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      let activeIndex = appendSeq.indexOf(active.id.toString());
      let overIndex = appendSeq.indexOf(over.id.toString());
      setAppendSeq(reorder(appendSeq, activeIndex, overIndex));
    }
  };
  const fetchContent = async () => {
    try {
      let data = await readProfileFile(property);
      let obj = yaml.load(data) as ISeqProfileConfig | null;
      setPrependSeq(obj?.prepend || []);
      setAppendSeq(obj?.append || []);
      setDeleteSeq(obj?.delete || []);
      setPrevData(data);
      setCurrData(data);
    } catch (error) {
      console.error("Failed to fetch or parse content:", error);
    }
  };

  useEffect(() => {
    if (currData === "" || !visualization) return;
    try {
      let obj = yaml.load(currData) as ISeqProfileConfig | null;
      setPrependSeq(obj?.prepend || []);
      setAppendSeq(obj?.append || []);
      setDeleteSeq(obj?.delete || []);
    } catch (e) {
      // Ignore parsing errors while typing
    }
  }, [visualization]);

  useEffect(() => {
    if (prependSeq && appendSeq && deleteSeq && visualization) {
      const serialize = () => {
        try {
          setCurrData(
            yaml.dump(
              { prepend: prependSeq, append: appendSeq, delete: deleteSeq },
              { forceQuotes: true },
            ),
          );
        } catch (e: any) {
          showNotice("error", e?.message || e?.toString() || "YAML dump error");
        }
      };
      if (window.requestIdleCallback) {
        window.requestIdleCallback(serialize);
      } else {
        setTimeout(serialize, 0);
      }
    }
  }, [prependSeq, appendSeq, deleteSeq, visualization]);

  const fetchProfile = async () => {
    try {
      let data = await readProfileFile(profileUid);
      let groupsData = await readProfileFile(groupsUid);
      let mergeData = await readProfileFile(mergeUid);
      let globalMergeData = await readProfileFile("Merge");

      let rulesObj = yaml.load(data) as { rules: [] } | null;
      let originGroupsObj = yaml.load(data) as { "proxy-groups": [] } | null;
      let originGroups = originGroupsObj?.["proxy-groups"] || [];
      let moreGroupsObj = yaml.load(groupsData) as ISeqProfileConfig | null;
      let morePrependGroups = moreGroupsObj?.["prepend"] || [];
      let moreAppendGroups = moreGroupsObj?.["append"] || [];
      let moreDeleteGroups =
        moreGroupsObj?.["delete"] || ([] as string[] | { name: string }[]);
      let groups = morePrependGroups.concat(
        originGroups.filter(
          (group: any) =>
            !moreDeleteGroups.some(
              (del: any) => (del.name || del) === group.name,
            ),
        ),
        moreAppendGroups,
      );

      let originRuleSetObj = yaml.load(data) as { "rule-providers": {} } | null;
      let originRuleSet = originRuleSetObj?.["rule-providers"] || {};
      let moreRuleSetObj = yaml.load(mergeData) as {
        "rule-providers": {};
      } | null;
      let moreRuleSet = moreRuleSetObj?.["rule-providers"] || {};
      let globalRuleSetObj = yaml.load(globalMergeData) as {
        "rule-providers": {};
      } | null;
      let globalRuleSet = globalRuleSetObj?.["rule-providers"] || {};
      let ruleSet = { ...originRuleSet, ...moreRuleSet, ...globalRuleSet };

      let originSubRuleObj = yaml.load(data) as { "sub-rules": {} } | null;
      let originSubRule = originSubRuleObj?.["sub-rules"] || {};
      let moreSubRuleObj = yaml.load(mergeData) as { "sub-rules": {} } | null;
      let moreSubRule = moreSubRuleObj?.["sub-rules"] || {};
      let globalSubRuleObj = yaml.load(globalMergeData) as {
        "sub-rules": {};
      } | null;
      let globalSubRule = globalSubRuleObj?.["sub-rules"] || {};
      let subRule = { ...originSubRule, ...moreSubRule, ...globalSubRule };

      setProxyPolicyList(
        builtinProxyPolicies.concat(groups.map((group: any) => group.name)),
      );
      setRuleSetList(Object.keys(ruleSet));
      setSubRuleList(Object.keys(subRule));
      setRuleList(rulesObj?.rules || []);
    } catch (error) {
      console.error("Failed to fetch profile data for editor:", error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchContent();
      fetchProfile();
    }
  }, [open]);

  const validateRule = () => {
    if ((ruleType.required ?? true) && !ruleContent) {
      throw new Error(t("Rule Condition Required"));
    }
    if (ruleType.validator && !ruleType.validator(ruleContent)) {
      throw new Error(t("Invalid Rule"));
    }
    const condition = (ruleType.required ?? true) ? ruleContent : "";
    return `${ruleType.name}${condition ? "," + condition : ""},${proxyPolicy}${noResolve && ruleType.noResolve ? ",no-resolve" : ""}`;
  };

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
            <DialogTitle>{t("Edit Rules")}</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisualization((prev) => !prev)}
            >
              {visualization ? t("Advanced") : t("Visualization")}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 mt-4">
          {visualization ? (
            <div className="h-full flex flex-row gap-4">
              <div className="w-1/3 flex flex-col gap-4 p-1">
                <div className="space-y-2">
                  <Label>{t("Rule Type")}</Label>
                  <Combobox
                    options={rules.map((r) => r.name)}
                    value={ruleType.name}
                    onSelect={(val) =>
                      setRuleType(
                        rules.find(
                          (r) => r.name.toLowerCase() === val.toLowerCase(),
                        ) || rules[0],
                      )
                    }
                  />
                </div>
                {(ruleType.required ?? true) && (
                  <div className="space-y-2">
                    <Label>{t("Rule Content")}</Label>
                    {ruleType.name === "RULE-SET" ||
                    ruleType.name === "SUB-RULE" ? (
                      <Combobox
                        options={
                          ruleType.name === "RULE-SET"
                            ? ruleSetList
                            : subRuleList
                        }
                        value={ruleContent}
                        onSelect={setRuleContent}
                      />
                    ) : (
                      <Input
                        value={ruleContent}
                        placeholder={ruleType.example}
                        onChange={(e) => setRuleContent(e.target.value)}
                      />
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t("Proxy Policy")}</Label>
                  <Combobox
                    options={proxyPolicyList}
                    value={proxyPolicy}
                    onSelect={setProxyPolicy}
                  />
                </div>
                {ruleType.noResolve && (
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      id="no-resolve-switch"
                      checked={noResolve}
                      onCheckedChange={setNoResolve}
                    />
                    <Label htmlFor="no-resolve-switch">{t("No Resolve")}</Label>
                  </div>
                )}
                <div className="flex flex-col gap-2 mt-auto">
                  <Button
                    onClick={() => {
                      try {
                        const raw = validateRule();
                        if (!prependSeq.includes(raw))
                          setPrependSeq([raw, ...prependSeq]);
                      } catch (err: any) {
                        showNotice("error", err.message);
                      }
                    }}
                  >
                    <ArrowUpToLine className="mr-2 h-4 w-4" />
                    {t("Prepend Rule")}
                  </Button>
                  <Button
                    onClick={() => {
                      try {
                        const raw = validateRule();
                        if (!appendSeq.includes(raw))
                          setAppendSeq([...appendSeq, raw]);
                      } catch (err: any) {
                        showNotice("error", err.message);
                      }
                    }}
                  >
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    {t("Append Rule")}
                  </Button>
                </div>
              </div>
              <Separator orientation="vertical" className="flex" />
              <div className="w-2/3 flex flex-col min-w-0 flex-1">
                <BaseSearchBox
                  onSearch={(matcher) => setMatch(() => matcher)}
                />
                <div className="flex-1 min-h-0 mt-2 rounded-md border">
                  <Virtuoso
                    className="h-full"
                    totalCount={
                      filteredRuleList.length +
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
                            <SortableContext items={filteredPrependSeq}>
                              {filteredPrependSeq.map((item) => (
                                <EditorRuleItem
                                  key={item}
                                  id={item}
                                  type="prepend"
                                  ruleRaw={item}
                                  onDelete={() =>
                                    setPrependSeq(
                                      prependSeq.filter((v) => v !== item),
                                    )
                                  }
                                />
                              ))}
                            </SortableContext>
                          </DndContext>
                        );
                      } else if (index < filteredRuleList.length + shift) {
                        const newIndex = index - shift;
                        const currentRule = filteredRuleList[newIndex];
                        return (
                          <EditorRuleItem
                            key={currentRule}
                            id={currentRule}
                            type={
                              deleteSeq.includes(currentRule)
                                ? "delete"
                                : "original"
                            }
                            ruleRaw={currentRule}
                            onDelete={() => {
                              if (deleteSeq.includes(currentRule)) {
                                setDeleteSeq(
                                  deleteSeq.filter((v) => v !== currentRule),
                                );
                              } else {
                                setDeleteSeq((prev) => [...prev, currentRule]);
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
                            <SortableContext items={filteredAppendSeq}>
                              {filteredAppendSeq.map((item) => (
                                <EditorRuleItem
                                  key={item}
                                  id={item}
                                  type="append"
                                  ruleRaw={item}
                                  onDelete={() =>
                                    setAppendSeq(
                                      appendSeq.filter((v) => v !== item),
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
