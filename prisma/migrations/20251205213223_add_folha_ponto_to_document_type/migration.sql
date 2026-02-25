-- Add FOLHA_PONTO to DocumentType enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'FOLHA_PONTO' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'DocumentType')
  ) THEN
    ALTER TYPE "DocumentType" ADD VALUE 'FOLHA_PONTO';
  END IF;
END
$$;
