-- Ensure created_by column exists in companies table
-- This migration adds the column if it doesn't exist (safe to run multiple times)

-- Check if column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'companies' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.companies
        ADD COLUMN created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;


