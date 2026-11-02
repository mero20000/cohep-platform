-- AlterTable: XP a student earns for a full-score attempt (additive; existing rows keep the old 100 XP behaviour)
ALTER TABLE "assessments" ADD COLUMN "xp_reward" INTEGER NOT NULL DEFAULT 100;
