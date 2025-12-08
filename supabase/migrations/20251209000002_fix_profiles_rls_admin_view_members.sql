-- ============================================================================
-- Fix profiles RLS to allow admins to view company members
-- ============================================================================
-- This migration ensures admins can view all members in their company
-- Uses SECURITY DEFINER function to avoid RLS recursion issues

-- STEP 1: Create SECURITY DEFINER function to check if user is admin of a company
-- This function bypasses RLS, so it won't cause recursion
CREATE OR REPLACE FUNCTION public.check_user_is_admin_of_company(target_company_id UUID)
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
  
  -- Check if user is admin of the target company
  -- This query bypasses RLS because it's SECURITY DEFINER
  -- First check role field (primary), then fallback to email match (backward compatibility)
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.companies c ON c.id = target_company_id
    WHERE p.id = auth.uid()
      AND p.company_id = target_company_id
      AND (
        -- Primary check: role field
        p.role = 'admin'
        OR
        -- Fallback: email matches company admin_email (backward compatibility)
        c.admin_email = p.email
      )
  );
END;
$$;

-- STEP 2: Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.check_user_is_admin_of_company(UUID) TO authenticated;

-- STEP 3: Drop ALL existing SELECT policies on profiles to avoid conflicts
-- We'll recreate only the ones we need
DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in same company" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Select own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile or admins can view company members" ON public.profiles;

-- STEP 4: Create the unified SELECT policy that handles both cases
-- This single policy replaces all previous SELECT policies
-- It allows:
-- 1. Users to view their own profile (always)
-- 2. Admins to view profiles of users in their company (using the function)
CREATE POLICY "Users can view their own profile or admins can view company members"
  ON public.profiles FOR SELECT
  USING (
    -- Users can always see their own profile
    id = auth.uid()
    OR
    -- Admins can see profiles in their company (uses function, no recursion)
    (
      company_id IS NOT NULL
      AND public.check_user_is_admin_of_company(company_id)
    )
  );

-- Users can update their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END $$;


-- Add a comment explaining the function
COMMENT ON FUNCTION public.check_user_is_admin_of_company(UUID) IS 
  'Checks if the current user is an admin of the target company. Uses role field (primary) or email match (fallback). Bypasses RLS to avoid recursion.';

-- ============================================================================
-- Verification
-- ============================================================================
-- After running this migration, verify:
-- 1. Admins can view all members in their company
-- 2. Members can view their own profile
-- 3. No infinite recursion errors
-- ============================================================================

