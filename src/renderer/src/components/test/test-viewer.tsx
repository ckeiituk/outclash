import { forwardRef, useImperativeHandle, useState } from "react";
import { useLockFn } from "ahooks";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { useVerge } from "@/hooks/use-verge";
import { nanoid } from "nanoid";
import { showNotice } from "@/services/noticeService";

// Новые импорты из shadcn/ui и lucide-react
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface Props {
  onChange: (uid: string, patch?: Partial<IVergeTestItem>) => void;
}

export interface TestViewerRef {
  create: () => void;
  edit: (item: IVergeTestItem) => void;
}

export const TestViewer = forwardRef<TestViewerRef, Props>((props, ref) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [openType, setOpenType] = useState<"new" | "edit">("new");
  const [loading, setLoading] = useState(false);
  const { verge, patchVerge } = useVerge();
  const testList = verge?.test_list ?? [];

  const form = useForm<IVergeTestItem>({
    defaultValues: { name: "", icon: "", url: "" },
  });
  const { control, handleSubmit, reset, setValue } = form;

  const patchTestList = async (uid: string, patch: Partial<IVergeTestItem>) => {
    const newList = testList.map((x) =>
      x.uid === uid ? { ...x, ...patch } : x,
    );
    await patchVerge({ test_list: newList });
  };

  useImperativeHandle(ref, () => ({
    create: () => {
      reset({ name: "", icon: "", url: "" });
      setOpenType("new");
      setOpen(true);
    },
    edit: (item) => {
      reset(item);
      setOpenType("edit");
      setOpen(true);
    },
  }));

  const handleOk = useLockFn(
    handleSubmit(async (formData) => {
      setLoading(true);
      try {
        if (!formData.name) throw new Error("`Name` should not be null");
        if (!formData.url) throw new Error("`Url` should not be null");

        if (formData.icon && formData.icon.startsWith("<svg")) {
          // --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---
          // Удаляем комментарии из SVG, используя правильное регулярное выражение
          formData.icon = formData.icon.replace(/<!--[\s\S]*?-->/g, "");
          // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

          const doc = new DOMParser().parseFromString(
            formData.icon,
            "image/svg+xml",
          );
          if (doc.querySelector("parsererror")) {
            throw new Error("`Icon`svg format error");
          }
        }

        if (openType === "new") {
          const uid = nanoid();
          const item = { ...formData, uid };
          const newList = [...testList, item];
          await patchVerge({ test_list: newList });
          props.onChange(uid);
        } else {
          if (!formData.uid) throw new Error("UID not found");
          await patchTestList(formData.uid, formData);
          props.onChange(formData.uid, formData);
        }

        setOpen(false);
      } catch (err: any) {
        showNotice("error", err.message || err.toString());
      } finally {
        setLoading(false);
      }
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {openType === "new" ? t("Create Test") : t("Edit Test")}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleOk} className="space-y-4">
            <FormField
              control={control}
              name="name"
              rules={{ required: true }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Name")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Icon")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={4}
                      placeholder="<svg>...</svg> or http(s)://..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="url"
              rules={{ required: true }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Test URL")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="https://www.google.com"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <button type="submit" className="hidden" />
          </form>
        </Form>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("Cancel")}
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleOk} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
