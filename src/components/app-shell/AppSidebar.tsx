import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InviteUserDialog } from "@/components/InviteUserDialog";
import { useProfile } from "@/hooks/useProfile";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  UserPlus,
  ChevronRight,
  ChevronDown,
  Plus,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AppSidebarProps {
  onNavigate?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, isAdmin, company, loading: profileLoading } = useProfile();
  
  // Debug admin status in development (only when profile loading is complete)
  useEffect(() => {
    if (import.meta.env.DEV && !profileLoading) {
      console.log("[AppSidebar] Admin Status Check:", {
        hasProfile: !!profile,
        hasCompany: !!company,
        profileEmail: profile?.email,
        companyAdminEmail: company?.admin_email,
        companyFromProfile: profile?.companies?.admin_email,
        emailsMatch: profile?.email === company?.admin_email,
        emailsMatchWithProfile: profile?.email === profile?.companies?.admin_email,
        isAdmin,
        companyId: profile?.company_id,
        shouldShowTeam: isAdmin && profile?.company_id,
        shouldShowAddUser: isAdmin && profile?.company_id,
        loading: profileLoading,
      });
    }
  }, [profile, company, isAdmin, profileLoading]);

  const [projectsOpen, setProjectsOpen] = useState<boolean>(false);
  const [teamOpen, setTeamOpen] = useState<boolean>(false);
  const [manageOpen, setManageOpen] = useState<boolean>(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState<boolean>(false);
  const [inviteAccessToken, setInviteAccessToken] = useState<string>("");

  const companyId = profile?.company_id ?? null;

  // Load projects when company_id is available (optimized: don't wait for profileLoading)
  useEffect(() => {
    if (companyId) {
      const loadProjects = async () => {
        setLoadingProjects(true);
        try {
          const { data: projectsData, error } = await supabase
            .from("projects")
            .select("id, name, description")
            .eq("company_id", companyId)
            .order("created_at", { ascending: false });

          if (error) {
            console.error("Error loading projects:", error);
            return;
          }

          if (projectsData) setProjects(projectsData);
        } catch (err) {
          console.error("Error loading projects:", err);
        } finally {
          setLoadingProjects(false);
        }
      };

      loadProjects();
    } else {
      setProjects([]);
    }
  }, [companyId]);

  const openProject = (id: string) => navigate(`/dataset/${id}`);

  const handleCreateProject = () => navigate("/dashboard?action=create-project");
  const handleSimulation = () => navigate("/dashboard");

  // When Add User clicked: ensure company exists and fetch access token, then open invite dialog
  const handleAddUser = async () => {
    if (!companyId) {
      navigate("/dashboard");
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token ?? "";
      setInviteAccessToken(token);
      setInviteOpen(true);
    } catch (err) {
      console.error("failed to get session token for invite", err);
      setInviteAccessToken("");
      setInviteOpen(true);
    }
  };

  const isActive = (path: string) => location.pathname === path;
  const isActiveStartsWith = (path: string) => location.pathname.startsWith(path);

  const navItems = [
    {
      label: "Overview",
      icon: LayoutDashboard,
      href: "/dashboard",
      active: isActive("/dashboard") && !location.pathname.includes("/dashboard/"),
    },
    {
      label: "Projects",
      icon: FolderKanban,
      href: "/dashboard/projects",
      active: isActiveStartsWith("/dashboard/projects") || isActiveStartsWith("/dataset/"),
      children: projects.length > 0 ? projects.map((p) => ({
        label: p.name,
        href: `/dataset/${p.id}`,
        active: location.pathname === `/dataset/${p.id}`,
      })) : [],
    },
    ...(isAdmin && companyId
      ? [
          {
            label: "Team",
            icon: Users,
            href: "/dashboard/team",
            active: isActiveStartsWith("/dashboard/team"),
            children: [
              {
                label: "View Members",
                href: "/dashboard/team/members",
                active: isActive("/dashboard/team/members"),
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <>
      <aside className="hidden md:block w-64 border-r bg-background min-h-[calc(100vh-4rem)]">
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isProjectsExpanded = projectsOpen && item.label === "Projects";
            const isTeamExpanded = teamOpen && item.label === "Team";

            return (
              <div key={item.label}>
                <Button
                  variant={item.active ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    item.active && "bg-secondary"
                  )}
                  onClick={() => {
                    if (item.label === "Projects") {
                      setProjectsOpen(!projectsOpen);
                      if (projectsOpen) setManageOpen(false);
                    } else if (item.label === "Team") {
                      setTeamOpen(!teamOpen);
                    } else if (!hasChildren) {
                      navigate(item.href);
                      onNavigate?.();
                    }
                  }}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                  {hasChildren && (
                    <span className="ml-auto">
                      {(isProjectsExpanded || isTeamExpanded) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </span>
                  )}
                </Button>

                {/* Team submenu */}
                {item.label === "Team" && isTeamExpanded && (
                  <div className="ml-6 mt-1 space-y-1">
                    {item.children?.map((child) => (
                      <Button
                        key={child.href}
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "w-full justify-start",
                          child.active && "bg-secondary"
                        )}
                        onClick={() => {
                          navigate(child.href!);
                          onNavigate?.();
                        }}
                      >
                        {child.label}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Projects submenu */}
                {item.label === "Projects" && isProjectsExpanded && (
                  <div className="ml-6 mt-1 space-y-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={handleCreateProject}
                      disabled={!companyId}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Project
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setManageOpen(!manageOpen)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Manage Projects
                      <span className="ml-auto">
                        {manageOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </span>
                    </Button>

                    {manageOpen && (
                      <div className="ml-4 mt-1 space-y-1 max-h-60 overflow-auto">
                        {loadingProjects && (
                          <div className="px-4 py-2 text-xs text-muted-foreground">
                            Loading...
                          </div>
                        )}

                        {!loadingProjects && projects.length === 0 && (
                          <div className="px-4 py-2 text-xs text-muted-foreground">
                            No projects yet
                          </div>
                        )}

                        {!loadingProjects &&
                          projects.map((p) => (
                            <Button
                              key={p.id}
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "w-full justify-start",
                                location.pathname === `/dataset/${p.id}` &&
                                  "bg-secondary"
                              )}
                              onClick={() => {
                                openProject(p.id);
                                onNavigate?.();
                              }}
                            >
                              <span className="truncate">{p.name}</span>
                            </Button>
                          ))}
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={handleSimulation}
                    >
                      Simulation
                    </Button>

                    {isAdmin && companyId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={handleAddUser}
                        disabled={!companyId}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add User
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Invite modal */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite user to company</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <InviteUserDialog
              companyId={companyId ?? ""}
              accessToken={inviteAccessToken}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

