-- Simplify RLS policy for companies INSERT
-- The foreign key constraint already ensures created_by exists in profiles
-- We don't need to check profile existence in the RLS policy itself

-- Drop existing INSERT policies (handle both possible names)
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;
DROP POLICY IF EXISTS " Users can createcompanies" ON public.companies;

-- Create simple INSERT policy that only checks auth.uid() = created_by
-- The foreign key constraint will handle the profile existence check
CREATE POLICY "Users can create companies"
  ON public.companies FOR INSERT
  WITH CHECK (auth.uid() = created_by);

