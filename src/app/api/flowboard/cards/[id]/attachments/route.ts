import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";
import { nanoid } from "nanoid";
import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".pif", ".vbs", ".js", ".ws", ".wsf",
  ".sh", ".bash", ".csh", ".ksh", ".ps1", ".psm1", ".psd1",
  ".php", ".phtml", ".php3", ".php4", ".php5", ".phps",
  ".jsp", ".jspx", ".asp", ".aspx", ".asa", ".asax",
  ".cgi", ".pl", ".py", ".rb", ".lua", ".war", ".ear",
]);

async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    const card = await prisma.flowCard.findUnique({ where: { id } });
    if (!card) return apiSuccess({ error: "Card not found" }, 404);

    await requireBoardAccess(card.boardId, user.id);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiSuccess({ error: "No file provided" }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return apiSuccess({ error: "File too large (max 10MB)" }, 400);
    }

    // Block dangerous file types
    const ext = path.extname(file.name).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return apiSuccess({ error: `File type "${ext}" is not allowed` }, 400);
    }

    await ensureUploadDir();

    // Generate unique filename
    const uniqueName = `${nanoid(12)}${ext}`;
    const filePath = path.join(UPLOAD_DIR, uniqueName);
    const fileUrl = `/uploads/${uniqueName}`;

    // Write file
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Create attachment record
    const attachment = await prisma.flowAttachment.create({
      data: {
        cardId: id,
        uploaderId: user.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/octet-stream",
        fileUrl,
      },
      include: {
        uploader: { select: { id: true, name: true } },
      },
    });

    // Log activity
    await prisma.flowActivity.create({
      data: {
        cardId: id,
        userId: user.id,
        type: "CARD_EDITED",
        content: `Uploaded "${file.name}"`,
      },
    });

    return apiSuccess(attachment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    const card = await prisma.flowCard.findUnique({ where: { id } });
    if (!card) return apiSuccess({ error: "Card not found" }, 404);

    await requireBoardAccess(card.boardId, user.id);

    const { attachmentId } = await request.json();
    if (!attachmentId) {
      return apiSuccess({ error: "attachmentId required" }, 400);
    }

    const attachment = await prisma.flowAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.cardId !== id) {
      return apiSuccess({ error: "Attachment not found" }, 404);
    }

    // Delete file from disk
    const filePath = path.join(process.cwd(), "public", attachment.fileUrl);
    try {
      await unlink(filePath);
    } catch {
      // File may already be deleted
    }

    // Delete record
    await prisma.flowAttachment.delete({ where: { id: attachmentId } });

    // Log activity
    await prisma.flowActivity.create({
      data: {
        cardId: id,
        userId: user.id,
        type: "CARD_EDITED",
        content: `Removed attachment "${attachment.fileName}"`,
      },
    });

    return apiSuccess({ message: "Attachment deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
