"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, UserCircle, X } from "@/components/icons";
import { resolveNeupId, type ResolvedAccount } from "./actions";

const DURATION_OPTIONS = [
  { label: "1 month", months: 1 },
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
] as const;

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

type PillButtonProps = {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function PillButton({ active, onClick, children }: PillButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm px-3 py-1 rounded-md border transition-colors ${
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-transparent text-muted-foreground border-border hover:bg-muted/40"
      }`}
    >
      {children}
    </button>
  );
}

export function AddMemberForm({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  const [neupIdInput, setNeupIdInput] = useState("");
  const [resolved, setResolved] = useState<ResolvedAccount | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isPermanent, setIsPermanent] = useState(true);
  const [selectedDuration, setSelectedDuration] = useState<1 | 3 | 6>(1);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleLookup = () => {
    if (!neupIdInput.trim()) return;
    setLookupError(null);
    startTransition(async () => {
      const result = await resolveNeupId(neupIdInput);
      if (result.success) {
        setResolved(result.account);
      } else {
        setLookupError(result.error);
        inputRef.current?.focus();
      }
    });
  };

  const handleClear = () => {
    setResolved(null);
    setNeupIdInput("");
    setLookupError(null);
    setIsPermanent(true);
    setSelectedDuration(1);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="px-4 py-3 grid gap-3">
      {/* Step 1 — NeupID lookup */}
      {!resolved ? (
        <div className="grid gap-1.5">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={neupIdInput}
              onChange={(e) => {
                setNeupIdInput(e.target.value.toLowerCase());
                if (lookupError) setLookupError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleLookup())}
              placeholder="Enter NeupID"
              className={`h-8 text-sm flex-1 ${lookupError ? "border-destructive focus-visible:ring-destructive" : ""}`}
              disabled={isPending}
            />
            <Button
              type="button"
              size="sm"
              onClick={handleLookup}
              disabled={isPending || !neupIdInput.trim()}
              className="shrink-0"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Look up"}
            </Button>
          </div>
          {lookupError && (
            <p className="text-xs text-destructive px-0.5">{lookupError}</p>
          )}
        </div>
      ) : (
        /* Step 2 — resolved account + options */
        <form action={action} className="grid gap-3">
          {/* Hidden fields */}
          <input type="hidden" name="member" value={resolved.accountId} />
          {isPermanent
            ? <input type="hidden" name="isPermanent" value="on" />
            : <input type="hidden" name="validTill" value={addMonths(selectedDuration)} />
          }

          {/* Resolved account chip */}
          <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <UserCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{resolved.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{neupIdInput}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Permanent / Temporary */}
          <div className="flex items-center gap-2">
            <PillButton active={isPermanent} onClick={() => setIsPermanent(true)}>
              Permanent
            </PillButton>
            <PillButton active={!isPermanent} onClick={() => setIsPermanent(false)}>
              Temporary
            </PillButton>
          </div>

          {/* Duration — only when temporary */}
          {!isPermanent && (
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <PillButton
                  key={opt.months}
                  active={selectedDuration === opt.months}
                  onClick={() => setSelectedDuration(opt.months as 1 | 3 | 6)}
                >
                  {opt.label}
                </PillButton>
              ))}
            </div>
          )}

          {/* Full access + submit */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Checkbox id="hasFullPermit" name="hasFullPermit" />
              <Label htmlFor="hasFullPermit" className="text-sm font-normal cursor-pointer">
                Full access
              </Label>
            </div>
            <Button type="submit" size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
