// @ts-nocheck
import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser } from "@/lib/flowboard/auth";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const boardId = searchParams.get("boardId");
    const filter = searchParams.get("filter") || "all"; // all, overdue, today, upcoming, completed

    // Get user's workspace IDs if no specific workspace
    let workspaceIds: string[] = [];
    if (workspaceId) {
      workspaceIds = [workspaceId];
    } else {
      const memberships = await prisma.flowWorkspaceMember.findMany({
        where: { userId: user.id },
        select: { workspaceId: true },
      });
      workspaceIds = memberships.map((m) => m.workspaceId);
    }

    // Get board IDs for these workspaces
    const boardWhere: Record<string, unknown> = {
      workspaceId: { in: workspaceIds },
      isArchived: false,
    };
    if (boardId) {
      boardWhere.id = boardId;
    }

    const boards = await prisma.flowBoard.findMany({
      where: boardWhere,
      select: { id: true },
    });
    const boardIds = boards.map((b) => b.id);

    // Build card query — only cards assigned to this user
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const cardWhere: Record<string, unknown> = {
      boardId: { in: boardIds },
      isArchived: false,
      members: { some: { userId: user.id } },
    };

    // Apply date filter
    if (filter === "overdue") {
      cardWhere.dueDate = { lt: todayStart };
      cardWhere.isCompleted = false;
    } else if (filter === "today") {
      cardWhere.dueDate = { gte: todayStart, lt: todayEnd };
      cardWhere.isCompleted = false;
    } else if (filter === "upcoming") {
      cardWhere.dueDate = { gte: todayEnd, lte: weekEnd };
      cardWhere.isCompleted = false;
    } else if (filter === "completed") {
      cardWhere.isCompleted = true;
    }

    const cards = await prisma.flowCard.findMany({
      where: cardWhere,
      include: {
        list: { select: { id: true, title: true } },
        board: { select: { id: true, title: true, backgroundColor: true } },
        labels: {
          include: { label: { select: { id: true, name: true, color: true } } },
        },
        checklists: {
          include: { items: { select: { isCompleted: true } } },
        },
        _count: { select: { comments: true, checklists: true, attachments: true } },
      },
      orderBy: [
        { isCompleted: "asc" },
        { dueDate: "asc" },
        { priority: "asc" },
        { updatedAt: "desc" },
      ],
    });

    // Compute summary counts
    const allAssigned = await prisma.flowCard.findMany({
      where: {
        boardId: { in: boardIds },
        isArchived: false,
        members: { some: { userId: user.id } },
      },
      select: { dueDate: true, isCompleted: true },
    });

    const overdue = allAssigned.filter(
      (c) => c.dueDate && c.dueDate < todayStart && !c.isCompleted
    ).length;
    const dueToday = allAssigned.filter(
      (c) => c.dueDate && c.dueDate >= todayStart && c.dueDate < todayEnd && !c.isCompleted
    ).length;
    const upcoming = allAssigned.filter(
      (c) => c.dueDate && c.dueDate >= todayEnd && c.dueDate <= weekEnd && !c.isCompleted
    ).length;
    const completed = allAssigned.filter((c) => c.isCompleted).length;

    return apiSuccess({
      cards,
      summary: {
        total: allAssigned.length,
        overdue,
        dueToday,
        upcoming,
        completed,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
