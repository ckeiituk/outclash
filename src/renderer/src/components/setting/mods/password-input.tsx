import { useState } from "react";
import { useTranslation } from "react-i18next";

// Новые импорты
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  // Компонент теперь сам управляет своим состоянием,
  // но вызывает onConfirm при подтверждении
  onConfirm: (passwd: string) => Promise<void>;
  // onCancel?: () => void; // Можно добавить, если нужна кнопка отмены
}

export const PasswordInput = (props: Props) => {
  const { onConfirm } = props;
  const { t } = useTranslation();
  const [passwd, setPasswd] = useState("");

  const handleSubmit = async (event?: React.FormEvent) => {
    // Предотвращаем стандартную отправку формы
    event?.preventDefault();
    await onConfirm(passwd);
  };

  return (
    // Этот диалог будет открыт всегда, пока он отрендерен на странице
    <AlertDialog open={true}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("Please enter your root password")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("This action requires administrator privileges.")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <Label htmlFor="password-input">{t("Password")}</Label>
            <Input
              id="password-input"
              type="password"
              autoFocus
              value={passwd}
              onChange={(e) => setPasswd(e.target.value)}
              className="mt-2"
            />
          </div>
          {/* Скрытая кнопка для того, чтобы Enter в поле ввода вызывал onSubmit */}
          <button type="submit" className="hidden" />
        </form>

        <AlertDialogFooter>
          {/* У этого диалога нет кнопки отмены */}
          <AlertDialogAction asChild>
            <Button type="button" onClick={handleSubmit}>
              {t("Confirm")}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
