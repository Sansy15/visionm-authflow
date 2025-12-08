import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { cn } from "@/lib/utils";

interface FormFieldWrapperProps {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
  touched?: boolean;
  required?: boolean;
  disabled?: boolean;
  children?: React.ReactNode; // For custom input components like Select
  className?: string;
}

export const FormFieldWrapper: React.FC<FormFieldWrapperProps> = ({
  label,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  touched,
  required = false,
  disabled = false,
  children,
  className,
}) => {
  const showError = touched && error;

  return (
    <div className={className}>
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children || (
        type === "password" ? (
          <PasswordInput
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(showError && "border-destructive")}
            aria-invalid={showError ? "true" : "false"}
            aria-describedby={showError ? `${name}-error` : undefined}
          />
        ) : (
          <Input
            id={name}
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(showError && "border-destructive")}
            aria-invalid={showError ? "true" : "false"}
            aria-describedby={showError ? `${name}-error` : undefined}
          />
        )
      )}
      {showError && (
        <p id={`${name}-error`} className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};


