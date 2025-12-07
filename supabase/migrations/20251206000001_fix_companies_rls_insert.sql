-- Fix RLS policy for companies INSERT
-- The issue: RLS policy checks auth.uid() = created_by, but the foreign key
-- constraint also requires created_by to exist in profiles table.
-- The problem occurs when profile is just created and RLS might not see it immediately.

-- Drop existing INSERT policies (handle both possible names)
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;
DROP POLICY IF EXISTS " Users can createcompanies" ON public.companies;

-- Create improved INSERT policy that:
-- 1. Checks auth.uid() = created_by (user can only create companies for themselves)
-- 2. Ensures the profile exists (foreign key requirement)
-- 3. Uses SECURITY DEFINER function to bypass RLS for the profile check
CREATE OR REPLACE FUNCTION public.check_user_can_create_company()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if profile exists (bypass RLS for this check)
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$;

-- Create the INSERT policy
CREATE POLICY "Users can create companies"
  ON public.companies FOR INSERT
  WITH CHECK (
    auth.uid() = created_by 
    AND public.check_user_can_create_company()
  );

