/**
 * Utility function to check if a user is an admin of a company
 * Admin is determined by:
 * 1. profile.role === 'admin' (primary check - explicit role)
 * 2. OR profile.email === company.admin_email (backward compatibility)
 */
export const isUserAdmin = (profile: any, company: any): boolean => {
  if (!profile || !company) return false;
  
  // Primary check: explicit role field
  if (profile.role === 'admin') {
    return true;
  }
  
  // Backward compatibility: email-based check
  if (profile.email === company.admin_email) {
    return true;
  }
  
  return false;
};


