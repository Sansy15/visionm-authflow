-- ============================================================================
-- Add role column to profiles table for explicit role management
-- ============================================================================
-- This migration adds a 'role' field to distinguish between 'admin' and 'member' roles
-- Backward compatible: existing admins (by email match) will still work

-- Step 1: Add role column with CHECK constraint
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('admin', 'member'));

-- Step 2: Set role for existing users based on current admin logic
-- Users who are admins (email matches company.admin_email) get role='admin'
UPDATE public.profiles p
SET role = 'admin'
WHERE EXISTS (
  SELECT 1 
  FROM public.companies c 
  WHERE c.id = p.company_id 
    AND c.admin_email = p.email
)
AND p.company_id IS NOT NULL;

-- Step 3: Set role='member' for users who have company_id but are not admins
UPDATE public.profiles p
SET role = 'member'
WHERE p.company_id IS NOT NULL
  AND role IS NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.companies c 
    WHERE c.id = p.company_id 
      AND c.admin_email = p.email
  );

-- Step 4: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_company_role ON public.profiles(company_id, role);

-- ============================================================================
-- Verification queries (run these to verify the migration)
-- ============================================================================
-- SELECT 
--   role,
--   COUNT(*) as count
-- FROM public.profiles
-- WHERE company_id IS NOT NULL
-- GROUP BY role;
--
-- Should show:
-- - admin: users whose email matches company.admin_email
-- - member: users with company_id but not admin
-- ============================================================================


