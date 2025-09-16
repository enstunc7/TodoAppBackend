import React from "react";

export const Card = ({ children, className = "" }) => (
  <div className={`card ${className}`}>{children}</div>
);

export const Button = ({ children, className = "", variant = "default", ...props }) => {
  const cls =
    "btn " +
    (variant === "primary" ? "btn--primary " : variant === "ghost" ? "btn--ghost " : "") +
    className;
  return (
    <button className={cls} {...props}>{children}</button>
  );
};

export const Input = ({ className = "", ...props }) => (
  <input className={`input ${className}`} {...props} />
);

export const Select = ({ className = "", ...props }) => (
  <select className={`select ${className}`} {...props} />
);
