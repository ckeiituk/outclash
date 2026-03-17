import { ReactNode } from "react";
import { useTranslation } from "react-i18next";

// --- Новые импорты ---
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react"; // Иконка для спиннера

// --- Интерфейсы ---
interface Props {
  title: ReactNode;
  open: boolean;
  okBtn?: ReactNode;
  cancelBtn?: ReactNode;
  disableOk?: boolean;
  disableCancel?: boolean;
  disableFooter?: boolean;
  className?: string; // Замена для contentSx, чтобы передавать классы Tailwind
  children?: ReactNode;
  loading?: boolean;
  onOk?: () => void;
  onCancel?: () => void;
  onClose?: () => void; // onOpenChange в shadcn/ui делает то же самое
}

export interface DialogRef {
  open: () => void;
  close: () => void;
}

export const BaseDialog: React.FC<Props> = (props) => {
  const {
    open,
    title,
    children,
    okBtn,
    cancelBtn,
    className,
    disableCancel,
    disableOk,
    disableFooter,
    loading,
    onClose,
    onCancel,
    onOk,
  } = props;

  const { t } = useTranslation();

  return (
    // Управляем состоянием через onOpenChange, которое вызывает onClose
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {children}

        {!disableFooter && (
          <DialogFooter>
            {!disableCancel && (
              <Button variant="outline" onClick={onCancel} disabled={loading}>
                {cancelBtn || t("Cancel")}
              </Button>
            )}
            {!disableOk && (
              <Button disabled={loading || disableOk} onClick={onOk}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {okBtn || t("Confirm")}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
