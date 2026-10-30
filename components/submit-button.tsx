"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { buttonClass, cx, type ButtonStyle } from "@/components/ui";

/**
 * Submit button for forms that post to a server action. While the action runs it is disabled
 * and shows a spinner, so one click is enough and a second click can't send it twice.
 * `unstyled` keeps the caller's own look (e.g. a card-shaped button).
 */
export function SubmitButton({ variant, size, unstyled, className, children, ...props }: ComponentProps<"button"> & ButtonStyle & { unstyled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button {...props} type="submit" disabled={pending || props.disabled} aria-busy={pending}
      className={cx(unstyled ? "disabled:cursor-wait" : buttonClass({ variant, size }), pending && "opacity-70", className)}>
      {children}
      {pending && <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />}
    </button>
  );
}
