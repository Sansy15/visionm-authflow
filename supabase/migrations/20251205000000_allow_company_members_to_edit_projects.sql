-- Drop the old policy that only allows project creators to update
DROP POLICY IF EXISTS "Project creators can update their projects" ON public.projects;

-- Create new policy that allows all company members to update projects
CREATE POLICY "Company members can update projects in their company"
  ON public.projects FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );


