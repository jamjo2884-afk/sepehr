import { NextResponse } from "next/server";

export function apiSuccess(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function apiUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function apiForbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function apiNotFound(resource = "Resource") {
  return NextResponse.json({ error: `${resource} not found` }, { status: 404 });
}

export function apiInternalError(message = "Internal server error") {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function handleApiError(error: unknown) {
  console.error("FlowBoard API Error:", error);

  if (error instanceof Error) {
    if (error.message === "Unauthorized") return apiUnauthorized();
    if (error.message.includes("Not a member")) return apiForbidden();
    if (error.message.includes("Insufficient permissions")) return apiForbidden();
    if (error.message.includes("No access")) return apiForbidden();
    if (error.message.includes("Only the workspace owner")) return apiForbidden();

    return apiError(error.message);
  }

  return apiInternalError();
}
