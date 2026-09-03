"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TasksPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/tasks/boards");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <p className="text-muted-foreground">Redirecting to boards...</p>
    </div>
  );
}
