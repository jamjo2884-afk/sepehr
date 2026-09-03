-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "flow_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_workspace_members" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_boards" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "workspace_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "background_color" TEXT,
    "background_image" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "is_favorited" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_board_members" (
    "id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_board_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_lists" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_cards" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "list_id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'NONE',
    "due_date" TIMESTAMP(3),
    "start_date" TIMESTAMP(3),
    "cover_color" TEXT,
    "cover_image" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_card_members" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "flow_card_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_card_watchers" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "flow_card_watchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_labels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "workspace_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_board_labels" (
    "id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,

    CONSTRAINT "flow_board_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_card_labels" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,

    CONSTRAINT "flow_card_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_checklists" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_checklist_items" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "assignee_id" TEXT,
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_comments" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_attachments" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "uploader_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_activities" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_automation_rules" (
    "id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "conditions" TEXT,
    "actions" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_board_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_id" TEXT NOT NULL,
    "template_data" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_board_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_card_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "title" TEXT NOT NULL,
    "card_description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NONE',
    "cover_color" TEXT,
    "labels" TEXT NOT NULL DEFAULT '[]',
    "checklists" TEXT NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_card_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flow_users_email_key" ON "flow_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "flow_workspaces_slug_key" ON "flow_workspaces"("slug");

-- CreateIndex
CREATE INDEX "flow_workspaces_owner_id_idx" ON "flow_workspaces"("owner_id");

-- CreateIndex
CREATE INDEX "flow_workspaces_slug_idx" ON "flow_workspaces"("slug");

-- CreateIndex
CREATE INDEX "flow_workspace_members_workspace_id_idx" ON "flow_workspace_members"("workspace_id");

-- CreateIndex
CREATE INDEX "flow_workspace_members_user_id_idx" ON "flow_workspace_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "flow_workspace_members_workspace_id_user_id_key" ON "flow_workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "flow_boards_workspace_id_idx" ON "flow_boards"("workspace_id");

-- CreateIndex
CREATE INDEX "flow_boards_owner_id_idx" ON "flow_boards"("owner_id");

-- CreateIndex
CREATE INDEX "flow_boards_position_idx" ON "flow_boards"("position");

-- CreateIndex
CREATE INDEX "flow_board_members_board_id_idx" ON "flow_board_members"("board_id");

-- CreateIndex
CREATE INDEX "flow_board_members_user_id_idx" ON "flow_board_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "flow_board_members_board_id_user_id_key" ON "flow_board_members"("board_id", "user_id");

-- CreateIndex
CREATE INDEX "flow_lists_board_id_idx" ON "flow_lists"("board_id");

-- CreateIndex
CREATE INDEX "flow_lists_position_idx" ON "flow_lists"("position");

-- CreateIndex
CREATE INDEX "flow_cards_list_id_idx" ON "flow_cards"("list_id");

-- CreateIndex
CREATE INDEX "flow_cards_board_id_idx" ON "flow_cards"("board_id");

-- CreateIndex
CREATE INDEX "flow_cards_position_idx" ON "flow_cards"("position");

-- CreateIndex
CREATE INDEX "flow_cards_due_date_idx" ON "flow_cards"("due_date");

-- CreateIndex
CREATE INDEX "flow_cards_created_by_idx" ON "flow_cards"("created_by");

-- CreateIndex
CREATE INDEX "flow_cards_is_archived_idx" ON "flow_cards"("is_archived");

-- CreateIndex
CREATE INDEX "flow_card_members_card_id_idx" ON "flow_card_members"("card_id");

-- CreateIndex
CREATE INDEX "flow_card_members_user_id_idx" ON "flow_card_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "flow_card_members_card_id_user_id_key" ON "flow_card_members"("card_id", "user_id");

-- CreateIndex
CREATE INDEX "flow_card_watchers_card_id_idx" ON "flow_card_watchers"("card_id");

-- CreateIndex
CREATE INDEX "flow_card_watchers_user_id_idx" ON "flow_card_watchers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "flow_card_watchers_card_id_user_id_key" ON "flow_card_watchers"("card_id", "user_id");

-- CreateIndex
CREATE INDEX "flow_labels_workspace_id_idx" ON "flow_labels"("workspace_id");

-- CreateIndex
CREATE INDEX "flow_board_labels_board_id_idx" ON "flow_board_labels"("board_id");

-- CreateIndex
CREATE UNIQUE INDEX "flow_board_labels_board_id_label_id_key" ON "flow_board_labels"("board_id", "label_id");

-- CreateIndex
CREATE INDEX "flow_card_labels_card_id_idx" ON "flow_card_labels"("card_id");

-- CreateIndex
CREATE UNIQUE INDEX "flow_card_labels_card_id_label_id_key" ON "flow_card_labels"("card_id", "label_id");

-- CreateIndex
CREATE INDEX "flow_checklists_card_id_idx" ON "flow_checklists"("card_id");

-- CreateIndex
CREATE INDEX "flow_checklist_items_checklist_id_idx" ON "flow_checklist_items"("checklist_id");

-- CreateIndex
CREATE INDEX "flow_comments_card_id_idx" ON "flow_comments"("card_id");

-- CreateIndex
CREATE INDEX "flow_comments_author_id_idx" ON "flow_comments"("author_id");

-- CreateIndex
CREATE INDEX "flow_attachments_card_id_idx" ON "flow_attachments"("card_id");

-- CreateIndex
CREATE INDEX "flow_activities_card_id_idx" ON "flow_activities"("card_id");

-- CreateIndex
CREATE INDEX "flow_activities_user_id_idx" ON "flow_activities"("user_id");

-- CreateIndex
CREATE INDEX "flow_activities_created_at_idx" ON "flow_activities"("created_at");

-- CreateIndex
CREATE INDEX "flow_automation_rules_board_id_idx" ON "flow_automation_rules"("board_id");

-- CreateIndex
CREATE INDEX "flow_board_templates_owner_id_idx" ON "flow_board_templates"("owner_id");

-- CreateIndex
CREATE INDEX "flow_card_templates_owner_id_idx" ON "flow_card_templates"("owner_id");

-- CreateIndex
CREATE INDEX "flow_card_templates_workspace_id_idx" ON "flow_card_templates"("workspace_id");

-- AddForeignKey
ALTER TABLE "flow_workspaces" ADD CONSTRAINT "flow_workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "flow_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_workspace_members" ADD CONSTRAINT "flow_workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "flow_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_workspace_members" ADD CONSTRAINT "flow_workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "flow_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_boards" ADD CONSTRAINT "flow_boards_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "flow_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_boards" ADD CONSTRAINT "flow_boards_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "flow_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_board_members" ADD CONSTRAINT "flow_board_members_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "flow_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_board_members" ADD CONSTRAINT "flow_board_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "flow_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_lists" ADD CONSTRAINT "flow_lists_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "flow_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_cards" ADD CONSTRAINT "flow_cards_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "flow_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_cards" ADD CONSTRAINT "flow_cards_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "flow_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_cards" ADD CONSTRAINT "flow_cards_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "flow_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_card_members" ADD CONSTRAINT "flow_card_members_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "flow_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_card_members" ADD CONSTRAINT "flow_card_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "flow_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_card_watchers" ADD CONSTRAINT "flow_card_watchers_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "flow_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_card_watchers" ADD CONSTRAINT "flow_card_watchers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "flow_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_labels" ADD CONSTRAINT "flow_labels_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "flow_workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_board_labels" ADD CONSTRAINT "flow_board_labels_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "flow_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_board_labels" ADD CONSTRAINT "flow_board_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "flow_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_card_labels" ADD CONSTRAINT "flow_card_labels_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "flow_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_card_labels" ADD CONSTRAINT "flow_card_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "flow_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_checklists" ADD CONSTRAINT "flow_checklists_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "flow_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_checklist_items" ADD CONSTRAINT "flow_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "flow_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_checklist_items" ADD CONSTRAINT "flow_checklist_items_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "flow_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_comments" ADD CONSTRAINT "flow_comments_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "flow_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_comments" ADD CONSTRAINT "flow_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "flow_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_attachments" ADD CONSTRAINT "flow_attachments_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "flow_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_attachments" ADD CONSTRAINT "flow_attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "flow_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_activities" ADD CONSTRAINT "flow_activities_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "flow_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_activities" ADD CONSTRAINT "flow_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "flow_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_automation_rules" ADD CONSTRAINT "flow_automation_rules_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "flow_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_automation_rules" ADD CONSTRAINT "flow_automation_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "flow_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_board_templates" ADD CONSTRAINT "flow_board_templates_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "flow_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_card_templates" ADD CONSTRAINT "flow_card_templates_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "flow_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_card_templates" ADD CONSTRAINT "flow_card_templates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "flow_workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

