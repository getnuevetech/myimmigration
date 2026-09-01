-- Repair TaxOnMe / MyImmigration brand leftovers on existing installs.
-- Idempotent: only rewrites known legacy brand strings.

UPDATE "Setting"
SET value = 'ImmigrationOnMe'
WHERE key = 'app.name'
  AND lower(trim(value)) IN ('taxonme', 'myimmigration');

UPDATE "Setting"
SET value = replace(replace(value, 'MyImmigration', 'ImmigrationOnMe'), 'TaxOnMe', 'ImmigrationOnMe')
WHERE value LIKE '%MyImmigration%' OR value LIKE '%TaxOnMe%';

UPDATE "ContentPage"
SET
  title = replace(replace(title, 'MyImmigration', 'ImmigrationOnMe'), 'TaxOnMe', 'ImmigrationOnMe'),
  body = replace(replace(body, 'MyImmigration', 'ImmigrationOnMe'), 'TaxOnMe', 'ImmigrationOnMe')
WHERE title LIKE '%MyImmigration%' OR title LIKE '%TaxOnMe%'
   OR body LIKE '%MyImmigration%' OR body LIKE '%TaxOnMe%';

UPDATE "MessageTemplate"
SET
  name = replace(replace(name, 'MyImmigration', 'ImmigrationOnMe'), 'TaxOnMe', 'ImmigrationOnMe'),
  subject = replace(replace(subject, 'MyImmigration', 'ImmigrationOnMe'), 'TaxOnMe', 'ImmigrationOnMe'),
  "bodyHtml" = replace(replace("bodyHtml", 'MyImmigration', 'ImmigrationOnMe'), 'TaxOnMe', 'ImmigrationOnMe')
WHERE name LIKE '%MyImmigration%' OR name LIKE '%TaxOnMe%'
   OR subject LIKE '%MyImmigration%' OR subject LIKE '%TaxOnMe%'
   OR "bodyHtml" LIKE '%MyImmigration%' OR "bodyHtml" LIKE '%TaxOnMe%';

UPDATE "PipelineStep"
SET "promptTemplate" = replace(replace("promptTemplate", 'MyImmigration', 'ImmigrationOnMe'), 'TaxOnMe', 'ImmigrationOnMe')
WHERE "promptTemplate" LIKE '%MyImmigration%' OR "promptTemplate" LIKE '%TaxOnMe%';

DELETE FROM "Setting" WHERE key = 'irs.account_url';
