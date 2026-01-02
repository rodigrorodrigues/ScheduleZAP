interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: "primary" | "secondary" | "white" | "gray";
  className?: string;
}

/**
 * Reusable loading spinner component
 */
export function Spinner({ size = "md", color = "primary", className = "" }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-8 w-8",
  };

  const colorClasses = {
    primary: "border-green-600",
    secondary: "border-gray-600",
    white: "border-white",
    gray: "border-gray-900",
  };

  return (
    <div
      className={`animate-spin rounded-full border-b-2 ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
    />
  );
}
