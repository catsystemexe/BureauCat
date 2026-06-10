ALTER TABLE "Document" ADD COLUMN "processed_markdown" TEXT;
ALTER TABLE "Document" ADD COLUMN "processing_status" TEXT NOT NULL DEFAULT 'processed';
ALTER TABLE "Document" ADD COLUMN "processing_error" TEXT;
ALTER TABLE "Document" ADD COLUMN "markdown_version" INTEGER NOT NULL DEFAULT 1;
