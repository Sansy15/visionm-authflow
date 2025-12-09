-- Enable RLS on workspace_join_requests table if not already enabled
ALTER TABLE public.workspace_join_requests ENABLE ROW LEVEL SECURITY;

-- Policy 1: Admins can view join requests for their company
-- Admins can SELECT requests where admin_email matches their email
CREATE POLICY "Admins can view their company requests"
ON public.workspace_join_requests
FOR SELECT
USING (
  admin_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

-- Policy 2: Admins can update join requests (approve/reject)
-- Admins can UPDATE requests where admin_email matches their email
CREATE POLICY "Admins can update their company requests"
ON public.workspace_join_requests
FOR UPDATE
USING (
  admin_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  admin_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

-- Policy 3: Users can view their own join requests
-- Users can SELECT their own requests
CREATE POLICY "Users can view their own requests"
ON public.workspace_join_requests
FOR SELECT
USING (user_id = auth.uid());

-- Policy 4: Users can create their own join requests
-- Users can INSERT requests where user_id matches their id
CREATE POLICY "Users can create their own requests"
ON public.workspace_join_requests
FOR INSERT
WITH CHECK (user_id = auth.uid());



