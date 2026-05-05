-- Add assetType field to authz_assets_access_grant table
ALTER TABLE "authz_assets_access_grant"
ADD COLUMN "asset_type" VARCHAR(255);

-- Create index on asset_type for query optimization
CREATE INDEX "authz_assets_access_grant_asset_type_idx" ON "authz_assets_access_grant"("asset_type");
