import {
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useTranslation } from "react-i18next";
import dayjs, { Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useLockFn } from "ahooks";

// Новые импорты
import { listWebDavBackup } from "@/services/cmds";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BaseLoadingOverlay } from "@/components/base"; // Наш рефакторенный компонент
import {
  BackupTableViewer,
  BackupFile,
  DEFAULT_ROWS_PER_PAGE,
} from "./backup-table-viewer"; // Наш рефакторенный компонент
import { BackupConfigViewer } from "./backup-config-viewer"; // Наш рефакторенный компонент

dayjs.extend(customParseFormat);

const DATE_FORMAT = "YYYY-MM-DD_HH-mm-ss";
const FILENAME_PATTERN = /\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/;

export interface DialogRef {
  open: () => void;
  close: () => void;
}

export const BackupViewer = forwardRef<DialogRef>((props, ref) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [backupFiles, setBackupFiles] = useState<BackupFile[]>([]);
  const [dataSource, setDataSource] = useState<BackupFile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }));

  const handleChangePage = useCallback(
    (_: React.MouseEvent<HTMLButtonElement> | null, newPage: number) => {
      setPage(newPage);
    },
    [],
  );

  const getAllBackupFiles = async (): Promise<BackupFile[]> => {
    const files = await listWebDavBackup();
    return files
      .map((file) => {
        const platform = file.filename.split("-")[0];
        const fileBackupTimeStr = file.filename.match(FILENAME_PATTERN);
        if (fileBackupTimeStr === null) return null;
        return {
          ...file,
          platform,
          backup_time: dayjs(fileBackupTimeStr[0], DATE_FORMAT),
          allow_apply: true,
        };
      })
      .filter((item): item is BackupFile => item !== null)
      .sort((a, b) => (a.backup_time.isAfter(b.backup_time) ? -1 : 1));
  };

  const fetchAndSetBackupFiles = useLockFn(async () => {
    try {
      setIsLoading(true);
      const files = await getAllBackupFiles();
      setBackupFiles(files);
      setTotal(files.length);
    } catch (error) {
      setBackupFiles([]);
      setTotal(0);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    setDataSource(
      backupFiles.slice(
        page * DEFAULT_ROWS_PER_PAGE,
        page * DEFAULT_ROWS_PER_PAGE + DEFAULT_ROWS_PER_PAGE,
      ),
    );
  }, [page, backupFiles]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("Backup Setting")}</DialogTitle>
        </DialogHeader>

        {/* Основной контейнер с relative для оверлея загрузки */}
        <div className="relative space-y-4">
          <BaseLoadingOverlay isLoading={isLoading} />

          <BackupConfigViewer
            setLoading={setIsLoading}
            onBackupSuccess={fetchAndSetBackupFiles}
            onSaveSuccess={fetchAndSetBackupFiles}
            onRefresh={fetchAndSetBackupFiles}
            onInit={fetchAndSetBackupFiles}
          />

          <Separator />

          <BackupTableViewer
            datasource={dataSource}
            page={page}
            onPageChange={handleChangePage}
            total={total}
            onRefresh={fetchAndSetBackupFiles}
          />
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
