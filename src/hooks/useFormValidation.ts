import { useState, useEffect, useCallback } from "react";
import { z } from "zod";

interface UseFormValidationOptions<T extends z.ZodTypeAny> {
  schema: T;
  initialValues: z.infer<T>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export function useFormValidation<T extends z.ZodTypeAny>({
  schema,
  initialValues,
  validateOnChange = false,
  validateOnBlur = true,
}: UseFormValidationOptions<T>) {
  const [values, setValues] = useState<z.infer<T>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isValid, setIsValid] = useState(false);

  // Validate all fields
  const validate = useCallback(
    (valuesToValidate: z.infer<T>): Record<string, string> => {
      const result = schema.safeParse(valuesToValidate);
      const fieldErrors: Record<string, string> = {};

      if (!result.success) {
        for (const issue of result.error.issues) {
          const field = issue.path[0] as string;
          fieldErrors[field] = issue.message;
        }
      }

      return fieldErrors;
    },
    [schema]
  );

  // Validate on values change if validateOnChange is true
  useEffect(() => {
    if (validateOnChange) {
      const fieldErrors = validate(values);
      setErrors(fieldErrors);
      setIsValid(Object.keys(fieldErrors).length === 0);
    }
  }, [values, validate, validateOnChange]);

  // Update field value
  const setValue = useCallback(
    <K extends keyof z.infer<T>>(field: K, value: z.infer<T>[K]) => {
      setValues((prev) => {
        const updated = { ...prev, [field]: value };
        
        if (validateOnChange) {
          const fieldErrors = validate(updated);
          setErrors(fieldErrors);
          setIsValid(Object.keys(fieldErrors).length === 0);
        }
        
        return updated;
      });
    },
    [validate, validateOnChange]
  );

  // Handle field change
  const handleChange = useCallback(
    <K extends keyof z.infer<T>>(field: K) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const value = e.target.value as z.infer<T>[K];
        setValue(field, value);
      },
    [setValue]
  );

  // Handle field blur
  const handleBlur = useCallback(
    <K extends keyof z.infer<T>>(field: K) =>
      (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
        setTouched((prev) => ({ ...prev, [field as string]: true }));

        if (validateOnBlur) {
          const fieldErrors = validate(values);
          setErrors((prev) => ({
            ...prev,
            [field as string]: fieldErrors[field as string] || "",
          }));
        }
      },
    [values, validate, validateOnBlur]
  );

  // Mark all fields as touched and validate
  const validateForm = useCallback((): boolean => {
    const allTouched = Object.keys(initialValues).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>);

    setTouched(allTouched);

    const fieldErrors = validate(values);
    setErrors(fieldErrors);
    const formIsValid = Object.keys(fieldErrors).length === 0;
    setIsValid(formIsValid);

    return formIsValid;
  }, [values, validate, initialValues]);

  // Reset form
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsValid(false);
  }, [initialValues]);

  // Get error for a specific field
  const getFieldError = useCallback(
    (field: keyof z.infer<T>): string | undefined => {
      return errors[field as string];
    },
    [errors]
  );

  // Check if field was touched
  const isFieldTouched = useCallback(
    (field: keyof z.infer<T>): boolean => {
      return touched[field as string] || false;
    },
    [touched]
  );

  // Set error for a specific field (for programmatic error setting)
  const setFieldError = useCallback(
    (field: keyof z.infer<T>, error: string) => {
      setErrors((prev) => ({
        ...prev,
        [field as string]: error,
      }));
    },
    []
  );

  // Set touched state for a specific field (for programmatic touch setting)
  const setFieldTouched = useCallback(
    (field: keyof z.infer<T>, touchedValue: boolean = true) => {
      setTouched((prev) => ({
        ...prev,
        [field as string]: touchedValue,
      }));
    },
    []
  );

  return {
    values,
    errors,
    touched,
    isValid,
    setValue,
    handleChange,
    handleBlur,
    validateForm,
    resetForm,
    getFieldError,
    isFieldTouched,
    setFieldError,
    setFieldTouched,
  };
}

