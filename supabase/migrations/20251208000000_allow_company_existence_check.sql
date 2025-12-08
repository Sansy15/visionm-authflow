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

