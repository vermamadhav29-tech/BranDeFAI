import { toast as sonnerToast } from "sonner";

export const toast = {
  success: (msg: string, desc?: string) =>
    sonnerToast.success(msg, { description: desc }),

  error: (msg: string, desc?: string) =>
    sonnerToast.error(msg, { description: desc }),

  info: (msg: string) => sonnerToast.info(msg),

  loading: (msg: string) => sonnerToast.loading(msg),

  promise: <T>(
    promise: Promise<T>,
    opts: { loading: string; success: string; error: string }
  ) => sonnerToast.promise(promise, opts),
};
