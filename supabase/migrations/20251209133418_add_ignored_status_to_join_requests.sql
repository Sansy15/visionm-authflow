-- Add 'ignored' status to workspace_join_requests status CHECK constraint
-- This allows requests to be marked as ignored (hidden from list) vs rejected (which may be used differently)

-- Drop existing constraint
ALTER TABLE public.workspace_join_requests
DROP CONSTRAINT IF EXISTS workspace_join_requests_status_check;

-- Add new constraint with 'ignored' status
ALTER TABLE public.workspace_join_requests
ADD CONSTRAINT workspace_join_requests_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'ignored', 'email_sent'));


