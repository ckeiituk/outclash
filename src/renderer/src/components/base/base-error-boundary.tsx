import { ReactNode } from "react";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react"; // Импортируем иконку

// Новый, стилизованный компонент для отображения ошибки
function ErrorFallback({ error }: FallbackProps) {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      className="m-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" />
        <h3 className="font-semibold">{t("Something went wrong")}</h3>
      </div>

      <pre className="mt-2 whitespace-pre-wrap rounded-md bg-destructive/10 p-2 text-xs font-mono">
        {error.message}
      </pre>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-medium hover:underline">
          {t("Error Stack")}
        </summary>
        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-2 text-xs font-mono text-muted-foreground">
          {error.stack}
        </pre>
      </details>
    </div>
  );
}

interface Props {
  children?: ReactNode;
}

export const BaseErrorBoundary = (props: Props) => {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {props.children}
    </ErrorBoundary>
  );
};
