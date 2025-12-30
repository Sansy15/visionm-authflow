import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const Landing = () => {
  const navigate = useNavigate();

  // Force light theme on landing page (no dark mode)
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    return () => {
      // Restore user's theme preference when leaving (if stored)
      const stored = localStorage.getItem("visionm-theme");
      if (stored === "dark") {
        document.documentElement.classList.add("dark");
      }
    };
  }, []);

  return (
    // Background image with theme-aware gradient overlay for consistent contrast
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: "url('/landing-bg.jpg')",
      }}
    >
      {/* Theme-aware overlay: darker in light mode, lighter in dark mode for better contrast */}
      <div className="absolute inset-0 bg-black/75 dark:bg-black/60" />
      {/* Content wrapper ensures everything sits above the image */}
      <div className="min-h-screen flex flex-col relative z-10">
        {/* NAV - reduced height, semi-transparent */}
        <nav className="bg-gradient-to-r from-primary/20 via-background/40 to-primary/20 backdrop-blur-sm border-b border-primary/30 shadow-md">
          <div className="container mx-auto px-6 py-3 flex justify-between items-center">
            <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">
              VisionM
            </h1>
            <div className="flex gap-4">
              {/* optionally add nav links */}
            </div>
          </div>
        </nav>

        {/* HERO */}
        <header className="container mx-auto px-6 py-20 flex-1">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-white dark:text-white text-4xl md:text-6xl font-extrabold leading-tight drop-shadow-[0_8px_20px_rgba(0,0,0,0.6)]">
              Manage Your Dataset Projects{" "}
              <span className="text-primary">Efficiently</span>
            </h2>

            <p className="mt-6 text-lg md:text-xl text-white/90 dark:text-white/80 max-w-2xl mx-auto drop-shadow-sm">
              VisionM helps teams collaborate on computer vision datasets with secure
              project management, workspace controls, and seamless file uploads.
            </p>

            <div className="flex gap-4 justify-center pt-8">
              <Button size="lg" onClick={() => navigate("/auth?mode=signup")}>
                Create Account
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
                Sign In
              </Button>
            </div>
          </div>
        </header>

        {/* FEATURE CARDS - glassy background so they pop on top of the image */}
        <main className="container mx-auto px-6 pb-20 -mt-8">
          <div className="mt-8 grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-lg bg-background/90 dark:bg-background/80 backdrop-blur-md border border-border/20 shadow-md">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                {/* icon */}
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Secure Workspaces</h3>
              <p className="text-muted-foreground text-sm">Enterprise-grade security with email verification and approval workflows for workspace access.</p>
            </div>

            <div className="p-6 rounded-lg bg-background/90 dark:bg-background/80 backdrop-blur-md border border-border/20 shadow-md">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Project Management</h3>
              <p className="text-muted-foreground text-sm">Create and manage multiple projects with granular access controls and project passwords.</p>
            </div>

            <div className="p-6 rounded-lg bg-background/90 dark:bg-background/80 backdrop-blur-md border border-border/20 shadow-md">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Dataset Uploads</h3>
              <p className="text-muted-foreground text-sm">Upload folders or multiple files with validation, versioning, and real-time processing status.</p>
            </div>
          </div>
        </main>

        {/* FOOTER */}
        <footer className="bg-gradient-to-r from-background/40 to-primary/20 backdrop-blur-sm border-t border-primary/30 py-3 text-center">
          © {new Date().getFullYear()} VisionM
        </footer>
      </div>
    </div>
  );
};

export default Landing;
