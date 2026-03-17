import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@root/lib/utils";

// Новые импорты
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CaseSensitive, WholeWord, Regex } from "lucide-react"; // Иконки из lucide-react

export type SearchState = {
  text: string;
  matchCase: boolean;
  matchWholeWord: boolean;
  useRegularExpression: boolean;
};

type SearchProps = {
  placeholder?: string;
  onSearch: (match: (content: string) => boolean, state: SearchState) => void;
};

export const BaseSearchBox = (props: SearchProps) => {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [matchWholeWord, setMatchWholeWord] = useState(false);
  const [useRegularExpression, setUseRegularExpression] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const createMatcher = useMemo(() => {
    return (searchText: string) => {
      try {
        setErrorMessage(""); // Сбрасываем ошибку при новой попытке
        return (content: string) => {
          if (!searchText) return true;
          const flags = matchCase ? "" : "i";

          if (useRegularExpression) {
            return new RegExp(searchText, flags).test(content);
          }

          let pattern = searchText.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"); // Экранируем спецсимволы
          if (matchWholeWord) {
            pattern = `\\b${pattern}\\b`;
          }

          return new RegExp(pattern, flags).test(content);
        };
      } catch (err: any) {
        setErrorMessage(err.message);
        return () => true; // Возвращаем "безопасный" матчер в случае ошибки
      }
    };
  }, [matchCase, matchWholeWord, useRegularExpression]);

  useEffect(() => {
    props.onSearch(createMatcher(text), {
      text,
      matchCase,
      matchWholeWord,
      useRegularExpression,
    });
  }, [matchCase, matchWholeWord, useRegularExpression, createMatcher]); // Убрали text из зависимостей

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setText(value);
    props.onSearch(createMatcher(value), {
      text: value,
      matchCase,
      matchWholeWord,
      useRegularExpression,
    });
  };

  const getToggleVariant = (isActive: boolean) =>
    isActive ? "secondary" : "ghost";

  return (
    <div className="w-full">
      <div className="relative">
        {/* Добавляем правый отступ, чтобы текст не заезжал под иконки */}
        <Input
          placeholder={props.placeholder ?? t("Filter conditions")}
          value={text}
          onChange={handleChange}
          className="pr-28" // pr-[112px]
        />
        {/* Контейнер для иконок, абсолютно спозиционированный справа */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={getToggleVariant(matchCase)}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setMatchCase(!matchCase)}
                >
                  <CaseSensitive className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("Match Case")}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={getToggleVariant(matchWholeWord)}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setMatchWholeWord(!matchWholeWord)}
                >
                  <WholeWord className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("Match Whole Word")}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={getToggleVariant(useRegularExpression)}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setUseRegularExpression(!useRegularExpression)}
                >
                  <Regex className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("Use Regular Expression")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      {/* Отображение ошибки под полем ввода */}
      {errorMessage && (
        <p className="mt-1 text-xs text-destructive">{errorMessage}</p>
      )}
    </div>
  );
};
