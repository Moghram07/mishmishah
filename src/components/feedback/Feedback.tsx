"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Copy } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { FEEDBACK_EMAIL, designLine, feedbackMailto, onDesignLine, setDesignLine } from "@/lib/feedback";
import { cn } from "@/lib/utils/cn";

/** The design last looked at, in one line — or null before any. */
export const useDesignLine = () => useSyncExternalStore(onDesignLine, designLine, () => null);

/** Says which design is on a stage while the stage is showing: the feedback email opens with it. */
export function PublishDesign({ line }: { line: string }) {
  useEffect(() => {
    setDesignLine(line);
  }, [line]);
  return null;
}

/** «شاركنا رأيك»: opens an email to the owner, the subject filled in, the design line first in it. */
export function FeedbackLink({ className, children }: { className?: string; children?: React.ReactNode }) {
  const { t } = useI18n();
  const line = useDesignLine();
  return (
    <a href={feedbackMailto(line)} className={className}>
      {children ?? t("feedback.send")}
    </a>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // an older phone, or a page not served securely: the old way
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** The address as text, beside a button that copies it — for a phone with no mail app set up. */
export function FeedbackEmail({ className }: { className?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <span className={cn("inline-flex max-w-full flex-wrap items-center gap-2", className)}>
      <span dir="ltr" className="select-all break-all text-sm font-medium text-foreground">
        {FEEDBACK_EMAIL}
      </span>
      <button
        type="button"
        onClick={async () => setCopied(await copyText(FEEDBACK_EMAIL))}
        aria-label={t("feedback.copyEmail")}
        className="btn-focus inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-apricot-400"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-apricot-600" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? t("feedback.copied") : t("feedback.copy")}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? t("feedback.copied") : ""}
      </span>
    </span>
  );
}
