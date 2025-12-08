import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordChecklistProps {
  password: string;
  className?: string;
}

export const PasswordChecklist: React.FC<PasswordChecklistProps> = ({ password, className }) => {
  const checks = [
    {
      label: "8+ characters",
      met: password.length >= 8,
    },
    {
      label: "lowercase letter",
      met: /[a-z]/.test(password),
    },
    {
      label: "uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      label: "number",
      met: /[0-9]/.test(password),
    },
    {
      label: "symbol",
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];

  return (
    <div className={cn("mt-2 space-y-2", className)}>
      {checks.map((check, index) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          <div
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded border transition-colors",
              check.met
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/30 bg-background"
            )}
          >
            {check.met && <Check className="h-3 w-3" />}
          </div>
          <span
            className={cn(
              check.met ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {check.label}
          </span>
        </div>
      ))}
    </div>
  );
};


