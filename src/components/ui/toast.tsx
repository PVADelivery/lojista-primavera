// Minimal type stubs to satisfy the legacy useToast hook.
// The actual toast UI is provided by sonner (src/components/ui/sonner.tsx).
import type * as React from "react";

export type ToastProps = {
  variant?: "default" | "destructive";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export type ToastActionElement = React.ReactElement;
