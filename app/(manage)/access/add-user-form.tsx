"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/core/hooks/use-toast";
import { grantAccessByNeupId } from "@/services/manage/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, UserPlus } from "@/components/icons";

export function AddUserForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await grantAccessByNeupId(formData);
      if (result.success) {
        toast({
          title: "Request Sent",
          description: "The user has been invited to manage this account.",
          className: "bg-accent text-accent-foreground",
        });
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(result.error || "An unknown error occurred.");
        inputRef.current?.focus();
      }
    });
  };

  return (
    <form ref={formRef} action={handleSubmit}>
      <div className="grid gap-1.5">
        <div className="relative">
          <Input
            ref={inputRef}
            name="neupId"
            placeholder="Enter NeupID"
            disabled={isPending}
            required
            onChange={(e) => {
              e.target.value = e.target.value.toLowerCase();
              if (error) setError(null);
            }}
            aria-invalid={!!error}
            className={`pr-10 ${error ? "border-destructive focus-visible:ring-destructive" : ""}`}
          />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            disabled={isPending}
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:bg-accent"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            <span className="sr-only">Grant Access</span>
          </Button>
        </div>
        {error && (
          <p className="text-xs text-destructive px-0.5">{error}</p>
        )}
      </div>
    </form>
  );
}
