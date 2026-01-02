import { ForwardedRef, forwardRef, TextareaHTMLAttributes } from "react";

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  helperText?: string;
}

/**
 * Reusable form textarea component with label and error handling
 */
export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, helperText, className = "", ...props }, ref: ForwardedRef<HTMLTextAreaElement>) => {
    return (
      <div>
        <label
          htmlFor={props.id || props.name}
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {label}
        </label>
        <textarea
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

FormTextarea.displayName = "FormTextarea";
