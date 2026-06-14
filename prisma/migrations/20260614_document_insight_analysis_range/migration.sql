ALTER TABLE "DocumentInsight" ADD COLUMN "analysis_start_offset" INTEGER;
ALTER TABLE "DocumentInsight" ADD COLUMN "analysis_end_offset" INTEGER;

CREATE INDEX "DocumentInsight_analysis_range_idx"
ON "DocumentInsight"("document_id", "analysis_start_offset", "analysis_end_offset");
