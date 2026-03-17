import * as React from "react";
import { Switch as ShadcnSwitch } from "@/components/ui/switch";
import { cn } from "@root/lib/utils";

// Тип пропсов остается без изменений
export type SwitchProps = React.ComponentPropsWithoutRef<typeof ShadcnSwitch>;

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, ...props }, ref) => {
    return <ShadcnSwitch className={cn(className)} ref={ref} {...props} />;
  },
);

Switch.displayName = "Switch";

export { Switch };
