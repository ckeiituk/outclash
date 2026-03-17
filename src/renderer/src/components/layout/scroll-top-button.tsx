import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@root/lib/utils";

interface Props {
  onClick: () => void;
  show: boolean;
  className?: string;
}

export const ScrollTopButton = ({ onClick, show, className }: Props) => {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      className={cn(
        "absolute bottom-5 right-5 h-10 w-10 rounded-full bg-background/50 backdrop-blur-sm transition-opacity hover:bg-background/75",
        show ? "opacity-100" : "opacity-0 pointer-events-none",
        className,
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
};
