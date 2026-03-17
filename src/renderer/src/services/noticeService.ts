import { toast } from "sonner";

type NoticeType = "success" | "error" | "info" | "warning";

export const showNotice = (
  type: NoticeType,
  message: string,
  duration?: number,
) => {
  const options = duration ? { duration } : {};

  switch (type) {
    case "success":
      toast.success(message, options);
      break;
    case "error":
      toast.error(message, options);
      break;
    case "info":
      toast.info(message, options);
      break;
    case "warning":
      toast.warning(message, options);
      break;
    default:
      toast(message, options);
      break;
  }
};
