import type { ReactNode } from 'react';
import { FlowLanguageWrapper } from './flow-language-wrapper';
import { TasksNav } from './tasks-nav';

export default function TasksLayout({ children }: { children: ReactNode }) {
  return (
    <FlowLanguageWrapper>
      <TasksNav />
      {children}
    </FlowLanguageWrapper>
  );
}