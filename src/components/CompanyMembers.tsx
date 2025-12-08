// src/components/CompanyMembers.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isUserAdmin } from "@/lib/utils/adminUtils";

interface CompanyMembersProps {
  companyId: string;
  company: any;
  isAdmin: boolean;
  refreshTrigger?: number; // Optional trigger to force refresh
}

interface MemberProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  company_id: string;
  role?: string;
}

export const CompanyMembers: React.FC<CompanyMembersProps> = ({
  companyId,
  company,
  isAdmin,
  refreshTrigger,
}) => {
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || !companyId) {
      setLoading(false);
      return;
    }
    fetchMembers();
  }, [companyId, isAdmin, refreshTrigger]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("[CompanyMembers] Fetching members for company:", companyId);
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("id, name, email, phone, created_at, company_id, role")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("[CompanyMembers] Fetch error:", fetchError);
        throw fetchError;
      }

      console.log("[CompanyMembers] Fetched members:", data?.length || 0, data);
      setMembers(data || []);
    } catch (err: any) {
      console.error("[CompanyMembers] Error fetching company members:", err);
      setError(err?.message || "Failed to load company members");
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">You don't have permission to view company members.</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const getMemberRole = (member: MemberProfile) => {
    // Check role field first (primary check)
    if (member.role === 'admin') {
      return "Admin";
    }
    // Fallback to email-based check (backward compatibility)
    if (company && member.email === company.admin_email) {
      return "Admin";
    }
    return "Member";
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading company members...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Company Members</h2>
        <p className="text-muted-foreground mt-1">
          View all members of your company and their details.
        </p>
      </div>

      {members.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No members found in this company.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4 font-semibold">Name</th>
                <th className="text-left p-4 font-semibold">Phone</th>
                <th className="text-left p-4 font-semibold">Email</th>
                <th className="text-left p-4 font-semibold">Role</th>
                <th className="text-left p-4 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b hover:bg-muted/50">
                  <td className="p-4 font-medium">{member.name || "No name"}</td>
                  <td className="p-4">{member.phone || "Not provided"}</td>
                  <td className="p-4 text-muted-foreground">{member.email}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-secondary">
                      {getMemberRole(member)}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground text-sm">
                    {formatDate(member.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CompanyMembers;

