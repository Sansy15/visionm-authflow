-- Add SELECT policy for company creators
CREATE POLICY "Company creators can view their company" 
ON public.companies
FOR SELECT
USING (auth.uid() = created_by);