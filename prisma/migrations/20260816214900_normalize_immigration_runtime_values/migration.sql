UPDATE "ConsultantProfile"
SET "credentialType" = CASE "credentialType"
  WHEN 'cpa' THEN 'attorney'
  WHEN 'ea' THEN 'accredited_representative'
  WHEN 'tax_consultant' THEN 'immigration_consultant'
  ELSE "credentialType"
END
WHERE "credentialType" IN ('cpa', 'ea', 'tax_consultant');

UPDATE "PathStep"
SET "actionKey" = CASE "actionKey"
  WHEN 'GET_TRANSCRIPT' THEN 'GET_CASE_RECORD'
  WHEN 'GET_ACCOUNT_TRANSCRIPT' THEN 'GET_ACCOUNT_RECORD'
  WHEN 'COMPLETE_FORM_9465' THEN 'COMPLETE_FORM_I485'
  ELSE "actionKey"
END
WHERE "actionKey" IN ('GET_TRANSCRIPT', 'GET_ACCOUNT_TRANSCRIPT', 'COMPLETE_FORM_9465');

UPDATE "Issue"
SET "issueType" = CASE "issueType"
  WHEN 'notice_response' THEN 'uscis_notice_response'
  WHEN 'missing_return' THEN 'missing_filing'
  WHEN 'balance_due' THEN 'fee_or_payment_issue'
  ELSE "issueType"
END
WHERE "issueType" IN ('notice_response', 'missing_return', 'balance_due');
