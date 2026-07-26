-- Add isActive column to churches for activate/deactivate support
ALTER TABLE "churches" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
