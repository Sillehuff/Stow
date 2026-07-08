import { useId } from "react";

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multiline = false
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
}) {
  const id = useId();
  const baseStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    borderRadius: "var(--stow-radius-input)",
    padding: "12px 16px",
    fontSize: 16,
    fontWeight: 500,
    outline: "none",
    border: "1.5px solid var(--stow-border)",
    background: "var(--stow-canvas)",
    color: "var(--stow-ink)",
    fontFamily: "inherit"
  };

  return (
    <div>
      <label
        htmlFor={id}
        style={{
          fontSize: 11,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          color: "var(--stow-warm)",
          marginBottom: 6
        }}
      >
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{ ...baseStyle, resize: "none" }}
        />
      ) : (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} style={baseStyle} />
      )}
    </div>
  );
}
