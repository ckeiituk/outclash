import * as React from "react";
import { cn } from "@root/lib/utils";

// 1. Убираем импорт несуществующего типа ButtonProps
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

// 2. Определяем наши пропсы, расширяя стандартный тип для кнопок из React
export interface TooltipIconProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip: React.ReactNode;
  icon?: React.ReactNode;
}

export const TooltipIcon = React.forwardRef<
  HTMLButtonElement,
  TooltipIconProps
>(({ tooltip, icon, className, ...props }, ref) => {
  const displayIcon = icon || <Info className="h-4 w-4" />;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={ref}
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7 text-muted-foreground", className)}
            {...props}
          >
            {displayIcon}
            <span className="sr-only">
              {typeof tooltip === "string" ? tooltip : "Icon button"}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {typeof tooltip === "string" ? <p>{tooltip}</p> : tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

TooltipIcon.displayName = "TooltipIcon";
