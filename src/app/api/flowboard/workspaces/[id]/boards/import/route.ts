import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireWorkspaceMember } from "@/lib/flowboard/auth";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    await requireWorkspaceMember(id, user.id);

    const body = await request.json();
    const { board: boardData } = body;

    if (!boardData?.title) {
      return apiSuccess({ error: "Invalid board data" }, 400);
    }

    // Create board
    const board = await prisma.flowBoard.create({
      data: {
        title: boardData.title,
        description: boardData.description,
        backgroundColor: boardData.backgroundColor,
        backgroundImage: boardData.backgroundImage,
        workspaceId: id,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: "ADMIN",
          },
        },
      },
    });

    // Create labels first
    const labelMap: Record<string, string> = {};
    if (boardData.labels) {
      for (const lb of boardData.labels) {
        const label = await prisma.flowLabel.create({
          data: {
            name: lb.name,
            color: lb.color,
            workspaceId: id,
          },
        });
        await prisma.flowBoardLabel.create({
          data: { boardId: board.id, labelId: label.id },
        });
        labelMap[lb.name] = label.id;
      }
    }

    // Create lists and cards
    if (boardData.lists) {
      for (let li = 0; li < boardData.lists.length; li++) {
        const listData = boardData.lists[li];
        const list = await prisma.flowList.create({
          data: {
            title: listData.title,
            boardId: board.id,
            position: listData.position ?? li,
          },
        });

        if (listData.cards) {
          for (let ci = 0; ci < listData.cards.length; ci++) {
            const cardData = listData.cards[ci];
            const card = await prisma.flowCard.create({
              data: {
                title: cardData.title,
                description: cardData.description,
                listId: list.id,
                boardId: board.id,
                position: cardData.position ?? ci,
                priority: cardData.priority || "NONE",
                dueDate: cardData.dueDate ? new Date(cardData.dueDate) : undefined,
                startDate: cardData.startDate ? new Date(cardData.startDate) : undefined,
                coverColor: cardData.coverColor,
                createdBy: user.id,
              },
            });

            // Add creator as member
            await prisma.flowCardMember.create({
              data: { cardId: card.id, userId: user.id },
            });

            // Add labels
            if (cardData.labels) {
              for (const lb of cardData.labels) {
                const labelId = labelMap[lb.name];
                if (labelId) {
                  await prisma.flowCardLabel.create({
                    data: { cardId: card.id, labelId },
                  });
                }
              }
            }

            // Add checklists
            if (cardData.checklists) {
              for (let cli = 0; cli < cardData.checklists.length; cli++) {
                const clData = cardData.checklists[cli];
                const checklist = await prisma.flowChecklist.create({
                  data: {
                    title: clData.title,
                    cardId: card.id,
                    position: cli,
                  },
                });

                if (clData.items) {
                  for (let ili = 0; ili < clData.items.length; ili++) {
                    await prisma.flowChecklistItem.create({
                      data: {
                        content: clData.items[ili].content,
                        checklistId: checklist.id,
                        isCompleted: clData.items[ili].isCompleted || false,
                        position: ili,
                      },
                    });
                  }
                }
              }
            }

            // Add comments
            if (cardData.comments) {
              for (const comment of cardData.comments) {
                await prisma.flowComment.create({
                  data: {
                    content: comment.content,
                    cardId: card.id,
                    authorId: user.id,
                  },
                });
              }
            }
          }
        }
      }
    }

    return apiSuccess({ boardId: board.id, message: "Board imported" }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
