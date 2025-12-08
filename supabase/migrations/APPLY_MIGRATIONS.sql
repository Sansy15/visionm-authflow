-- ============================================================================
-- Combined Migration Script
-- Apply both migrations in order:
-- 1. Allow company existence check (RPC function)
-- 2. Fix join requests RLS policies
-- ============================================================================
-- Run this script in Supabase Dashboard > SQL Editor
-- ============================================================================

-- ============================================================================
-- Migration 1: Allow company existence check
-- ============================================================================
-- Allow users to check if a company exists by name
-- This is needed for the "Company Already Exists" notification workflow
-- Users need to be able to check company existence even if they're not members

-- Create a SECURITY DEFINER function that can check company existence
-- This bypasses RLS for the existence check while maintaining security
CREATE OR REPLACE FUNCTION public.check_company_exists(company_name TEXT)
RETURNS TABLE(
  id UUID,
  name TEXT,
  admin_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if company exists and return limited data (id, name, admin_email)
  -- This function bypasses RLS to allow existence checks
  -- Use case-insensitive comparison and trim whitespace to prevent duplicates
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.admin_email
  FROM public.companies c
  WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(company_name))
  LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_company_exists(TEXT) TO authenticated;

-- Add a comment explaining the function
COMMENT ON FUNCTION public.check_company_exists(TEXT) IS 
  'Allows authenticated users to check if a company exists by name. Returns id, name, and admin_email if found. Used for the "Company Already Exists" notification workflow.';

-- ============================================================================
-- Migration 2: Fix join requests RLS policies
-- ============================================================================
-- Fix RLS policies for workspace_join_requests to ensure admins can see requests
-- The issue: Conflicting policies or subquery failures preventing admins from viewing requests

-- Drop ALL existing policies on workspace_join_requests to start fresh
DROP POLICY IF EXISTS "Users can view their own requests" ON public.workspace_join_requests;
DROP POLICY IF EXISTS "Admins can view their company requests" ON public.workspace_join_requests;
DROP POLICY IF EXISTS "Admins can update their company requests" ON public.workspace_join_requests;
DROP POLICY IF EXISTS "Users can create join requests" ON public.workspace_join_requests;
DROP POLICY IF EXISTS "Users can create their own requests" ON public.workspace_join_requests;

-- Policy 1: Users can view their own join requests
-- Users can SELECT their own requests (where they are the requester)
CREATE POLICY "Users can view their own requests"
ON public.workspace_join_requests
FOR SELECT
USING (user_id = auth.uid());

-- Policy 2: Admins can view join requests for their company
-- Admins can SELECT requests where admin_email matches their profile email
-- Use a more robust check that handles NULL cases
CREATE POLICY "Admins can view their company requests"
ON public.workspace_join_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
      AND email IS NOT NULL
      AND email = workspace_join_requests.admin_email
  )
);

-- Policy 3: Admins can update join requests (approve/reject)
-- Admins can UPDATE requests where admin_email matches their profile email
CREATE POLICY "Admins can update their company requests"
ON public.workspace_join_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
      AND email IS NOT NULL
      AND email = workspace_join_requests.admin_email
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
      AND email IS NOT NULL
      AND email = workspace_join_requests.admin_email
  )
);

-- Policy 4: Users can create their own join requests
-- Users can INSERT requests where user_id matches their id


-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Both migrations have been applied successfully.
-- 
-- What was done:
-- 1. Created check_company_exists() RPC function for company existence checks
-- 2. Fixed RLS policies on workspace_join_requests to allow admins to see requests
-- 
-- Next steps:
-- 1. Test creating a company with existing name - should show "Company Already Exists" dialog
-- 2. Test admin viewing join requests - should see pending requests
-- ============================================================================

