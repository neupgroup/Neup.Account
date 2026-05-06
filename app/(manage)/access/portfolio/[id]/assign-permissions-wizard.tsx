"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  UserCircle, 
  Database, 
  Key, 
  Check, 
  X, 
  Loader2,
  ChevronRight,
  ChevronLeft,
} from "@/components/icons";
import { getSelectableAssets, type AssetType, type SelectableAsset } from "./actions";
import { getRolesForAssetType, type AssetRole } from "@/services/manage/access/assets";

type Member = { id: string; accountId: string; displayName: string };

const ASSET_TYPES: { type: AssetType; label: string }[] = [
  { type: "brand_account", label: "Brand Account" },
  { type: "branch_account", label: "Branch Account" },
  { type: "application", label: "Application" },
];

type Step = "member" | "asset-type" | "assets" | "roles" | "confirm";

export function AssignPermissionsWizard({
  action,
  members,
  existingAssetIds,
}: {
  action: (formData: FormData) => Promise<void>;
  members: Member[];
  existingAssetIds: string[];
}) {
  const [step, setStep] = useState<Step>("member");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedAssetType, setSelectedAssetType] = useState<AssetType | null>(null);
  const [availableAssets, setAvailableAssets] = useState<SelectableAsset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<SelectableAsset[]>([]);
  const [availableRoles, setAvailableRoles] = useState<AssetRole[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  const handleMemberSelect = (member: Member) => {
    setSelectedMember(member);
    setStep("asset-type");
  };

  const handleAssetTypeSelect = (type: AssetType) => {
    setSelectedAssetType(type);
    setIsLoading(true);
    startTransition(async () => {
      const [assets, roles] = await Promise.all([
        getSelectableAssets(type, existingAssetIds),
        getRolesForAssetType(type),
      ]);
      setAvailableAssets(assets);
      setAvailableRoles(roles);
      setIsLoading(false);
      setStep("assets");
    });
  };

  const handleAssetToggle = (asset: SelectableAsset) => {
    setSelectedAssets((prev) => {
      const exists = prev.find((a) => a.assetId === asset.assetId);
      if (exists) {
        return prev.filter((a) => a.assetId !== asset.assetId);
      }
      return [...prev, asset];
    });
  };

  const handleRoleToggle = (roleId: string) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  };

  const handleReset = () => {
    setStep("member");
    setSelectedMember(null);
    setSelectedAssetType(null);
    setAvailableAssets([]);
    setSelectedAssets([]);
    setAvailableRoles([]);
    setSelectedRoles(new Set());
  };

  const canProceedFromAssets = selectedAssets.length > 0;
  const canProceedFromRoles = selectedRoles.size > 0;

  return (
    <div className="px-4 py-3 grid gap-4">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={step === "member" ? "text-foreground font-medium" : ""}>
          1. Member
        </span>
        <ChevronRight className="h-3 w-3" />
        <span className={step === "asset-type" ? "text-foreground font-medium" : ""}>
          2. Asset Type
        </span>
        <ChevronRight className="h-3 w-3" />
        <span className={step === "assets" ? "text-foreground font-medium" : ""}>
          3. Assets
        </span>
        <ChevronRight className="h-3 w-3" />
        <span className={step === "roles" ? "text-foreground font-medium" : ""}>
          4. Roles
        </span>
        <ChevronRight className="h-3 w-3" />
        <span className={step === "confirm" ? "text-foreground font-medium" : ""}>
          5. Confirm
        </span>
      </div>

      {/* Step 1: Select Member */}
      {step === "member" && (
        <div className="grid gap-2">
          <p className="text-sm font-medium">Select a member</p>
          <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleMemberSelect(m)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
              >
                <UserCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm">{m.displayName}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Select Asset Type */}
      {step === "asset-type" && selectedMember && (
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{selectedMember.displayName}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep("member")}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Back
            </Button>
          </div>
          <p className="text-sm font-medium">Select asset type</p>
          <div className="grid gap-2">
            {ASSET_TYPES.map((t) => (
              <button
                key={t.type}
                type="button"
                onClick={() => handleAssetTypeSelect(t.type)}
                disabled={isLoading}
                className="flex items-center gap-3 rounded-md border px-4 py-3 text-left hover:bg-muted/40 transition-colors disabled:opacity-50"
              >
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Select Assets */}
      {step === "assets" && selectedAssetType && (
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline">{ASSET_TYPES.find((t) => t.type === selectedAssetType)?.label}</Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep("asset-type");
                setSelectedAssets([]);
              }}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Back
            </Button>
          </div>
          <p className="text-sm font-medium">
            Select assets ({selectedAssets.length} selected)
          </p>
          {isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading assets…
            </div>
          ) : availableAssets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No assets available.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
              {availableAssets.map((asset) => {
                const isSelected = selectedAssets.some((a) => a.assetId === asset.assetId);
                return (
                  <button
                    key={asset.assetId}
                    type="button"
                    onClick={() => handleAssetToggle(asset)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded border">
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{asset.name}</p>
                      {asset.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{asset.subtitle}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => setStep("roles")}
              disabled={!canProceedFromAssets}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Select Roles */}
      {step === "roles" && (
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline">{selectedAssets.length} assets selected</Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep("assets")}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Back
            </Button>
          </div>
          <p className="text-sm font-medium">
            Select roles ({selectedRoles.size} selected)
          </p>
          {availableRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No roles available for this asset type.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
              {availableRoles.map((role) => {
                const isSelected = selectedRoles.has(role.id);
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleRoleToggle(role.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded border">
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{role.name}</p>
                      {role.description && (
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => setStep("confirm")}
              disabled={!canProceedFromRoles}
            >
              Review
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Confirm */}
      {step === "confirm" && selectedMember && (
        <form action={action} className="grid gap-4">
          {/* Hidden fields */}
          <input type="hidden" name="memberId" value={selectedMember.id} />
          <input type="hidden" name="assetIds" value={selectedAssets.map((a) => a.assetId).join(",")} />
          <input type="hidden" name="assetType" value={selectedAssetType || ""} />
          <input type="hidden" name="roleIds" value={Array.from(selectedRoles).join(",")} />

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Review and confirm</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep("roles")}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Back
            </Button>
          </div>

          <div className="rounded-md border p-4 space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Member</p>
              <p className="font-medium">{selectedMember.displayName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Assets ({selectedAssets.length})</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {selectedAssets.map((a) => (
                  <Badge key={a.assetId} variant="secondary" className="text-xs">
                    {a.name}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Roles ({selectedRoles.size})</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {Array.from(selectedRoles).map((roleId) => {
                  const role = availableRoles.find((r) => r.id === roleId);
                  return (
                    <Badge key={roleId} variant="outline" className="text-xs">
                      {role?.name ?? roleId}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Assigning…
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Assign Permissions
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
