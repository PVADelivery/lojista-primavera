import { useAntiSpamMonitor } from "@/hooks/useAntiSpamMonitor";

interface GlobalAntiSpamProps {
  appName?: string;
}

export function GlobalAntiSpam({ appName = "Painel do Lojista" }: GlobalAntiSpamProps) {
  useAntiSpamMonitor({ appName });
  return null;
}
