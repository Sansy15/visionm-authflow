-- ============================================================================
-- Get user info for join requests (bypasses RLS for admin viewing)
-- ============================================================================
-- This function allows admins to view user name and email for pending join requests
-- even if the user is not yet a member of their company (RLS would normally block this)

CREATE OR REPLACE FUNCTION public.get_join_request_user_info(request_user_id UUID)
RETURNS TABLE(
  name TEXT,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return user name and email from profiles table
  -- This bypasses RLS to allow admins to see user info for pending requests
  RETURN QUERY
  SELECT 
    p.name,
    p.email
  FROM public.profiles p
  WHERE p.id = request_user_id
  LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_join_request_user_info(UUID) TO authenticated;

-- Add a comment explaining the function
COMMENT ON FUNCTION public.get_join_request_user_info(UUID) IS 
  'Allows admins to view user name and email for pending join requests. Bypasses RLS to enable viewing user info even when user is not yet a company member.';


