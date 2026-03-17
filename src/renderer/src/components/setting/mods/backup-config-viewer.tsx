import { useState, useRef, memo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { useVerge } from "@/hooks/use-verge";
import { isValidUrl } from "@/utils/helper";
import { useLockFn } from "ahooks";

// Новые импорты
import { saveWebdavConfig, createWebdavBackup } from "@/services/cmds";
import { showNotice } from "@/services/noticeService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@root/lib/utils";

export interface BackupConfigViewerProps {
  onBackupSuccess: () => Promise<void>;
  onSaveSuccess: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onInit: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

export const BackupConfigViewer = memo(
  ({
    onBackupSuccess,
    onSaveSuccess,
    onRefresh,
    onInit,
    setLoading,
  }: BackupConfigViewerProps) => {
    const { t } = useTranslation();
    const { verge } = useVerge();
    const { webdav_url, webdav_username, webdav_password } = verge || {};
    const [showPassword, setShowPassword] = useState(false);

    const form = useForm<IWebDavConfig>({
      defaultValues: { url: "", username: "", password: "" },
    });

    // Синхронизируем форму с данными из verge
    useEffect(() => {
      form.reset({
        url: webdav_url,
        username: webdav_username,
        password: webdav_password,
      });
    }, [webdav_url, webdav_username, webdav_password, form.reset]);

    const { register, handleSubmit, watch, getValues } = form;
    const url = watch("url");
    const username = watch("username");
    const password = watch("password");

    const webdavChanged =
      webdav_url !== url ||
      webdav_username !== username ||
      webdav_password !== password;

    const checkForm = () => {
      const values = getValues();
      if (!values.url) {
        showNotice("error", t("WebDAV URL Required"));
        throw new Error("URL Required");
      }
      if (!isValidUrl(values.url)) {
        showNotice("error", t("Invalid WebDAV URL"));
        throw new Error("Invalid URL");
      }
      if (!values.username) {
        showNotice("error", t("Username Required"));
        throw new Error("Username Required");
      }
      if (!values.password) {
        showNotice("error", t("Password Required"));
        throw new Error("Password Required");
      }
    };

    const save = useLockFn(async (data: IWebDavConfig) => {
      try {
        checkForm();
      } catch {
        return;
      }
      try {
        setLoading(true);
        await saveWebdavConfig(
          data.url.trim(),
          data.username.trim(),
          data.password,
        );
        showNotice("success", t("WebDAV Config Saved"));
        await onSaveSuccess();
      } catch (error) {
        showNotice("error", t("WebDAV Config Save Failed", { error }), 3000);
      } finally {
        setLoading(false);
      }
    });

    const handleBackup = useLockFn(async () => {
      try {
        checkForm();
      } catch {
        return;
      }
      try {
        setLoading(true);
        await createWebdavBackup();
        showNotice("success", t("Backup Created"));
        await onBackupSuccess();
      } catch (error) {
        showNotice("error", t("Backup Failed", { error }));
      } finally {
        setLoading(false);
      }
    });

    return (
      <Form {...form}>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col sm:flex-row gap-4"
        >
          {/* Левая часть: поля ввода */}
          <div className="flex-1 space-y-4">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("WebDAV Server URL")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Username")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Password")}</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? "text" : "password"}
                          {...field}
                          className="pr-10"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-0 right-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Правая часть: кнопки действий */}
          <div className="flex sm:flex-col gap-2">
            {webdavChanged || !webdav_url ? (
              <Button
                type="button"
                className="w-full h-full"
                onClick={handleSubmit(save)}
              >
                {t("Save")}
              </Button>
            ) : (
              <>
                <Button type="button" className="w-full" onClick={handleBackup}>
                  {t("Backup")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={onRefresh}
                >
                  {t("Refresh")}
                </Button>
              </>
            )}
          </div>
        </form>
      </Form>
    );
  },
);
