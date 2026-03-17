import { SearchState } from "@/components/base/base-search-box";

interface Props {
  value: ILogItem;
  searchState?: SearchState;
}

const LogItem = ({ value, searchState }: Props) => {
  const renderHighlightText = (text: string) => {
    if (!searchState?.text.trim()) return text;

    try {
      const searchText = searchState.text;
      let pattern: string;

      if (searchState.useRegularExpression) {
        try {
          new RegExp(searchText);
          pattern = searchText;
        } catch {
          pattern = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }
      } else {
        const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        pattern = searchState.matchWholeWord ? `\\b${escaped}\\b` : escaped;
      }

      const flags = searchState.matchCase ? "g" : "gi";
      const parts = text.split(new RegExp(`(${pattern})`, flags));

      return parts.map((part, index) => {
        return index % 2 === 1 ? (
          <span
            key={index}
            className="highlight bg-yellow-300 dark:bg-yellow-500 bg-opacity-50 dark:bg-opacity-40 rounded px-0.5"
          >
            {part}
          </span>
        ) : (
          part
        );
      });
    } catch {
      return text;
    }
  };

  let typeColorClass = "text-gray-500 dark:text-gray-400";
  const lowerCaseType = value.type.toLowerCase();

  if (lowerCaseType === "error" || lowerCaseType === "err") {
    typeColorClass = "text-red-500 dark:text-red-400";
  } else if (lowerCaseType === "warning" || lowerCaseType === "warn") {
    typeColorClass = "text-yellow-500 dark:text-yellow-400";
  } else if (lowerCaseType === "info" || lowerCaseType === "inf") {
    typeColorClass = "text-blue-500 dark:text-blue-400";
  }

  return (
    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-sm font-mono select-text">
      <div>
        <span className="text-gray-500 dark:text-gray-400 mr-2">
          {renderHighlightText(value.time || "")}
        </span>
        <span
          className={`inline-block ml-2 text-center rounded uppercase font-semibold ${typeColorClass}`}
          data-type={lowerCaseType}
        >
          {renderHighlightText(value.type)}
        </span>
      </div>
      <div className="text-foreground break-all whitespace-pre-wrap">
        {renderHighlightText(value.payload)}
      </div>
    </div>
  );
};

export default LogItem;
