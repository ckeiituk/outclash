import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Inbox } from "lucide-react"; // 1. Импортируем иконку из lucide-react

interface Props {
  text?: ReactNode;
  extra?: ReactNode;
}

export const BaseEmpty = (props: Props) => {
  const { text = "Empty", extra } = props;
  const { t } = useTranslation();

  return (
    // 2. Заменяем Box на div и переводим sx в классы Tailwind
    <div className="flex h-full w-full flex-col items-center justify-center space-y-4 text-muted-foreground/75">
      {/* 3. Заменяем иконку MUI на lucide-react и задаем размер классами */}
      <Inbox className="h-20 w-20" />

      {/* 4. Заменяем Typography на p */}
      <p className="text-xl">{t(`${text}`)}</p>

      {extra}
    </div>
  );
};
