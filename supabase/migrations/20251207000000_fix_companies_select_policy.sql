-- Fix RLS SELECT policy for companies table
-- The issue: Users with company_id in their profile can't fetch their company
-- This ensures both members and creators can view the company

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Users can view their company" ON public.companies;
DROP POLICY IF EXISTS "Company creators can view their company" ON public.companies;

-- Create a unified SELECT policy that allows:
-- 1. Users who are members of the company (have company_id in their profile)
-- 2. Users who created the company
CREATE POLICY "Users can view their company"
  ON public.companies FOR SELECT
  USING (
    -- User is a member of the company (their profile has this company_id)
    id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid() 
        AND company_id IS NOT NULL
    )
    OR
    -- User created the company
    created_by = auth.uid()
  );



