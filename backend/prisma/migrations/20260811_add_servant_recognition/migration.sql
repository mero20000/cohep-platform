-- CreateTable
CREATE TABLE "servant_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "years_of_service" INTEGER NOT NULL DEFAULT 0,
    "total_students" INTEGER NOT NULL DEFAULT 0,
    "total_sessions" INTEGER NOT NULL DEFAULT 0,
    "total_hymns" INTEGER NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "current_level_name" TEXT,
    "current_group_name" TEXT,
    "previous_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_calculated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servant_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servant_milestones" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "reached_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servant_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "servant_profiles_user_id_key" ON "servant_profiles"("user_id");

-- CreateIndex
CREATE INDEX "servant_profiles_school_id_idx" ON "servant_profiles"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "servant_milestones_user_id_type_threshold_key" ON "servant_milestones"("user_id", "type", "threshold");

-- CreateIndex
CREATE INDEX "servant_milestones_user_id_idx" ON "servant_milestones"("user_id");

-- AddForeignKey
ALTER TABLE "servant_profiles" ADD CONSTRAINT "servant_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servant_profiles" ADD CONSTRAINT "servant_profiles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servant_milestones" ADD CONSTRAINT "servant_milestones_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "servant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;