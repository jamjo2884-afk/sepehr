
"use client";

import type { ReactNode } from "react";
import { FlowLanguageProvider } from "@/i18n/flowboard/context";

export function FlowLanguageWrapper({ children }: { children: ReactNode }) {
  return <FlowLanguageProvider>{children}</FlowLanguageProvider>;
}
