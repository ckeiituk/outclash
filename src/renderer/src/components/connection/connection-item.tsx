import dayjs from "dayjs";
import { useLockFn } from "ahooks";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteConnection } from "@/services/api";
import parseTraffic from "@/utils/parse-traffic";

interface TagProps {
  children: React.ReactNode;
  className?: string;
}

const Tag: React.FC<TagProps> = ({ children, className }) => {
  const baseClasses =
    "text-[10px] px-1 leading-[1.375] border rounded-[4px] border-muted-foreground/35";
  return (
    <span className={`${baseClasses} ${className || ""}`}>{children}</span>
  );
};

interface Props {
  value: IConnectionsItem;
  onShowDetail?: () => void;
}

export const ConnectionItem = (props: Props) => {
  const { value, onShowDetail } = props;

  const { id, metadata, chains, start, curUpload, curDownload } = value;

  const onDelete = useLockFn(async () => deleteConnection(id));
  const showTraffic = curUpload! >= 100 || curDownload! >= 100;

  return (
    <div className="flex items-center justify-between p-3 border-b border-border dark:border-border">
      <div
        className="flex-grow select-text cursor-pointer mr-2"
        onClick={onShowDetail}
      >
        <div className="text-sm font-medium text-foreground">
          {metadata.host || metadata.destinationIP}
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          <Tag className="uppercase text-green-600 dark:text-green-500">
            {metadata.network}
          </Tag>

          <Tag>{metadata.type}</Tag>

          {!!metadata.process && <Tag>{metadata.process}</Tag>}

          {chains?.length > 0 && <Tag>{[...chains].reverse().join(" / ")}</Tag>}

          <Tag>{dayjs(start).fromNow()}</Tag>

          {showTraffic && (
            <Tag>
              {parseTraffic(curUpload!)} / {parseTraffic(curDownload!)}
            </Tag>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="ml-2 flex-shrink-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
