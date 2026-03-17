import { Link, useMatch, useResolvedPath } from "react-router-dom";
import { useVerge } from "@/hooks/use-verge";
import { cn } from "@root/lib/utils";

interface Props {
  to: string;
  children: string;
  icon: React.ReactNode[];
}

export const LayoutItem = (props: Props) => {
  const { to, children, icon } = props;
  const { verge } = useVerge();
  const { menu_icon } = verge ?? {};
  const resolved = useResolvedPath(to);
  const match = useMatch({ path: resolved.pathname, end: true });

  return (
    <Link
      to={to}
      className={cn(
        "flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        match
          ? "bg-primary text-primary-foreground shadow-md"
          : "hover:bg-muted/50",
        "mx-auto my-1 w-[calc(100%-10px)]",
      )}
    >
      {(menu_icon === "monochrome" || !menu_icon) && (
        <span className="mr-2 text-foreground">{icon[0]}</span>
      )}
      {menu_icon === "colorful" && <span className="mr-2">{icon[1]}</span>}
      <span
        className={cn(
          "text-center",
          menu_icon === "disable" ? "" : "ml-[-35px]",
        )}
      >
        {children}
      </span>
    </Link>
  );
};
