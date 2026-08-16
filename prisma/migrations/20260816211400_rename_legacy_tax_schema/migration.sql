ALTER TABLE "KnowledgeSource" RENAME COLUMN "taxYear" TO "caseYear";
ALTER TABLE "Issue" RENAME COLUMN "taxYear" TO "caseYear";
ALTER TABLE "Issue" RENAME COLUMN "irsBasis" TO "uscisBasis";
ALTER TABLE "Notice" RENAME COLUMN "taxYear" TO "caseYear";

ALTER TABLE "IrsFormTemplate" RENAME TO "UscisFormTemplate";
ALTER TABLE "UscisFormTemplate" RENAME CONSTRAINT "IrsFormTemplate_pkey" TO "UscisFormTemplate_pkey";
ALTER TABLE "FormSubmission" RENAME CONSTRAINT "FormSubmission_templateId_fkey" TO "FormSubmission_templateId_uscis_fkey";
