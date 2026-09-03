import type { ReactNode } from "react";
import { FlowLanguageWrapper } from "./flow-language-wrapper";

export default function TasksLayout({ children }: { children: ReactNode }) {
  return <FlowLanguageWrapper>{children}</FlowLanguageWrapper>;
}
