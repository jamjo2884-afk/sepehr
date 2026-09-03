import { z } from "zod";

// ============================================================
// Workspace
// ============================================================

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "MEMBER", "GUEST"]),
});

// ============================================================
// Board
// ============================================================

export const createBoardSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  backgroundColor: z.string().max(20).optional(),
  backgroundImage: z.string().max(500).optional(),
});

export const updateBoardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  backgroundColor: z.string().max(20).optional(),
  backgroundImage: z.string().max(500).optional(),
  isArchived: z.boolean().optional(),
  isFavorited: z.boolean().optional(),
  position: z.number().optional(),
});

// ============================================================
// List
// ============================================================

export const createListSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  position: z.number().optional(),
});

export const updateListSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  position: z.number().optional(),
  isArchived: z.boolean().optional(),
});

// ============================================================
// Card
// ============================================================

export const createCardSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  listId: z.string(),
  position: z.number().optional(),
  description: z.string().max(10000).optional(),
  priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().optional(),
  startDate: z.string().optional(),
  coverColor: z.string().max(20).optional(),
  coverImage: z.string().max(500).optional(),
});

export const updateCardSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(10000).optional(),
  listId: z.string().optional(),
  position: z.number().optional(),
  priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  coverColor: z.string().max(20).nullable().optional(),
  coverImage: z.string().max(500).nullable().optional(),
  isArchived: z.boolean().optional(),
  isCompleted: z.boolean().optional(),
});

export const moveCardSchema = z.object({
  listId: z.string(),
  position: z.number(),
});

// ============================================================
// Label
// ============================================================

export const createLabelSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  color: z.string().min(1, "Color is required").max(20),
});

export const updateLabelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().min(1).max(20).optional(),
});

// ============================================================
// Checklist
// ============================================================

export const createChecklistSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
});

export const updateChecklistSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

export const createChecklistItemSchema = z.object({
  content: z.string().min(1, "Content is required").max(500),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
});

export const updateChecklistItemSchema = z.object({
  content: z.string().min(1).max(500).optional(),
  isCompleted: z.boolean().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

// ============================================================
// Comment
// ============================================================

export const createCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(5000),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

// ============================================================
// Board Reorder
// ============================================================

export const reorderListsSchema = z.object({
  lists: z.array(
    z.object({
      id: z.string(),
      position: z.number(),
    })
  ),
});

export const reorderCardsSchema = z.object({
  cards: z.array(
    z.object({
      id: z.string(),
      listId: z.string(),
      position: z.number(),
    })
  ),
});
