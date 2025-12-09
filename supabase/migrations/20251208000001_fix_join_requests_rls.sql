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
CREATE POLICY "Users can create their own requests"
ON public.workspace_join_requests
FOR INSERT
WITH CHECK (user_id = auth.uid());


