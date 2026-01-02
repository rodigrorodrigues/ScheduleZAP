import { ForwardedRef, forwardRef, InputHTMLAttributes } from "react";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

/**
 * Reusable form input component with label and error handling
 */
export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, helperText, className = "", ...props }, ref: ForwardedRef<HTMLInputElement>) => {
    return (
      <div>
        <label
          htmlFor={props.id || props.name}
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {label}
        </label>
        <input
          ref={ref}
          className={`input-field ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

FormInput.displayName = "FormInput";
