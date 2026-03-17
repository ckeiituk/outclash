import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  Header,
  ColumnSizingState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { truncateStr } from "@/utils/truncate-str";
import parseTraffic from "@/utils/parse-traffic";
import { t } from "i18next";
import { cn } from "@root/lib/utils";

dayjs.extend(relativeTime);

interface IConnectionsItem {
  id: string;
  metadata: {
    host: string;
    destinationIP: string;
    destinationPort: string;
    remoteDestination: string;
    process?: string;
    processPath?: string;
    sourceIP: string;
    sourcePort: string;
    type: string;
    network: string;
  };
  rule: string;
  rulePayload?: string;
  chains: string[];
  download: number;
  upload: number;
  curDownload?: number;
  curUpload?: number;
  start: string;
}

interface ConnectionRow {
  id: string;
  host: string;
  download: number;
  upload: number;
  dlSpeed: number;
  ulSpeed: number;
  chains: string;
  rule: string;
  process: string;
  time: string;
  source: string;
  remoteDestination: string;
  type: string;
  connectionData: IConnectionsItem;
}

interface Props {
  connections: IConnectionsItem[];
  onShowDetail: (data: IConnectionsItem) => void;
  scrollerRef: (element: HTMLElement | Window | null) => void;
}

const ColumnResizer = ({
  header,
}: {
  header: Header<ConnectionRow, unknown>;
}) => {
  return (
    <div
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      className={cn(
        "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none",
        "bg-transparent hover:bg-primary/50 active:bg-primary",
        "transition-colors duration-150",
        header.column.getIsResizing() && "bg-primary",
      )}
      style={{
        transform: header.column.getIsResizing() ? `translateX(0px)` : "",
      }}
    />
  );
};

export const ConnectionTable = (props: Props) => {
  const { connections, onShowDetail, scrollerRef } = props;
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tableContainerRef.current && scrollerRef) {
      scrollerRef(tableContainerRef.current);
    }
  }, [scrollerRef]);

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    try {
      const saved = localStorage.getItem("connection-table-widths");
      return saved
        ? JSON.parse(saved)
        : {
            host: 220,
            download: 88,
            upload: 88,
            dlSpeed: 88,
            ulSpeed: 88,
            chains: 340,
            rule: 280,
            process: 220,
            time: 120,
            source: 200,
            remoteDestination: 200,
            type: 160,
          };
    } catch {
      return {
        host: 220,
        download: 88,
        upload: 88,
        dlSpeed: 88,
        ulSpeed: 88,
        chains: 340,
        rule: 280,
        process: 220,
        time: 120,
        source: 200,
        remoteDestination: 200,
        type: 160,
      };
    }
  });

  useEffect(() => {
    localStorage.setItem(
      "connection-table-widths",
      JSON.stringify(columnSizing),
    );
  }, [columnSizing]);

  const connRows = useMemo((): ConnectionRow[] => {
    return connections.map((each) => {
      const { metadata, rulePayload } = each;
      const chains = [...each.chains].reverse().join(" / ");
      const rule = rulePayload ? `${each.rule}(${rulePayload})` : each.rule;
      const Destination = metadata.destinationIP
        ? `${metadata.destinationIP}:${metadata.destinationPort}`
        : `${metadata.remoteDestination}:${metadata.destinationPort}`;
      return {
        id: each.id,
        host: metadata.host
          ? `${metadata.host}:${metadata.destinationPort}`
          : `${metadata.remoteDestination}:${metadata.destinationPort}`,
        download: each.download,
        upload: each.upload,
        dlSpeed: each.curDownload ?? 0,
        ulSpeed: each.curUpload ?? 0,
        chains,
        rule,
        process: truncateStr(metadata.process || metadata.processPath) ?? "",
        time: each.start,
        source: `${metadata.sourceIP}:${metadata.sourcePort}`,
        remoteDestination: Destination,
        type: `${metadata.type}(${metadata.network})`,
        connectionData: each,
      };
    });
  }, [connections]);

  const columns = useMemo<ColumnDef<ConnectionRow>[]>(
    () => [
      {
        accessorKey: "host",
        header: () => t("Host"),
        size: columnSizing?.host || 220,
        minSize: 180,
        maxSize: 400,
      },
      {
        accessorKey: "download",
        header: () => t("Downloaded"),
        size: columnSizing?.download || 88,
        minSize: 80,
        maxSize: 150,
        cell: ({ getValue }) => (
          <div className="text-right font-mono text-sm">
            {parseTraffic(getValue<number>()).join(" ")}
          </div>
        ),
      },
      {
        accessorKey: "upload",
        header: () => t("Uploaded"),
        size: columnSizing?.upload || 88,
        minSize: 80,
        maxSize: 150,
        cell: ({ getValue }) => (
          <div className="text-right font-mono text-sm">
            {parseTraffic(getValue<number>()).join(" ")}
          </div>
        ),
      },
      {
        accessorKey: "dlSpeed",
        header: () => t("DL Speed"),
        size: columnSizing?.dlSpeed || 88,
        minSize: 80,
        maxSize: 150,
        cell: ({ getValue }) => (
          <div className="text-right font-mono text-sm">
            {parseTraffic(getValue<number>()).join(" ")}/s
          </div>
        ),
      },
      {
        accessorKey: "ulSpeed",
        header: () => t("UL Speed"),
        size: columnSizing?.ulSpeed || 88,
        minSize: 80,
        maxSize: 150,
        cell: ({ getValue }) => (
          <div className="text-right font-mono text-sm">
            {parseTraffic(getValue<number>()).join(" ")}/s
          </div>
        ),
      },
      {
        accessorKey: "chains",
        header: () => t("Chains"),
        size: columnSizing?.chains || 340,
        minSize: 180,
        maxSize: 500,
      },
      {
        accessorKey: "rule",
        header: () => t("Rule"),
        size: columnSizing?.rule || 280,
        minSize: 180,
        maxSize: 400,
      },
      {
        accessorKey: "process",
        header: () => t("Process"),
        size: columnSizing?.process || 220,
        minSize: 180,
        maxSize: 350,
      },
      {
        accessorKey: "time",
        header: () => t("Time"),
        size: columnSizing?.time || 120,
        minSize: 100,
        maxSize: 180,
        cell: ({ getValue }) => (
          <div className="text-right font-mono text-sm">
            {dayjs(getValue<string>()).fromNow()}
          </div>
        ),
      },
      {
        accessorKey: "source",
        header: () => t("Source"),
        size: columnSizing?.source || 200,
        minSize: 130,
        maxSize: 300,
      },
      {
        accessorKey: "remoteDestination",
        header: () => t("Destination"),
        size: columnSizing?.remoteDestination || 200,
        minSize: 130,
        maxSize: 300,
      },
      {
        accessorKey: "type",
        header: () => t("Type"),
        size: columnSizing?.type || 160,
        minSize: 100,
        maxSize: 220,
      },
    ],
    [columnSizing],
  );

  const table = useReactTable({
    data: connRows,
    columns,
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  const totalTableWidth = useMemo(() => {
    return table.getCenterTotalSize();
  }, [table.getState().columnSizing]);

  if (connRows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{t("No connections")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border relative bg-background">
      <Table
        className="w-full border-collapse table-fixed"
        style={{
          width: totalTableWidth,
          minWidth: "100%",
        }}
      >
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="hover:bg-transparent border-b-0 h-10"
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "sticky top-0 z-10",
                    "p-2 text-xs font-semibold select-none border-r last:border-r-0 bg-background h-10",
                  )}
                  style={{
                    width: header.getSize(),
                    minWidth: header.column.columnDef.minSize,
                    maxWidth: header.column.columnDef.maxSize,
                  }}
                >
                  <div className="flex items-center justify-between h-full">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </div>
                  {header.column.getCanResize() && (
                    <ColumnResizer header={header} />
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && "selected"}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onShowDetail(row.original.connectionData)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className="p-2 whitespace-nowrap overflow-hidden text-ellipsis text-sm border-r last:border-r-0"
                  style={{
                    width: cell.column.getSize(),
                    minWidth: cell.column.columnDef.minSize,
                    maxWidth: cell.column.columnDef.maxSize,
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
