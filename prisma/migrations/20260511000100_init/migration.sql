CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'IT_MANAGER', 'IT_STAFF');

CREATE TYPE "AssetCategory" AS ENUM (
  'LAPTOP',
  'DESKTOP',
  'MONITOR',
  'PHONE',
  'TABLET',
  'PERIPHERAL',
  'OTHER'
);

CREATE TYPE "AssetStatus" AS ENUM (
  'AVAILABLE',
  'ASSIGNED',
  'UNDER_REPAIR',
  'RETIRED'
);

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Asset" (
  "id" TEXT NOT NULL,
  "tag" TEXT NOT NULL,
  "brand" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "serialNumber" TEXT NOT NULL,
  "purchaseCost" DECIMAL(65,30) NOT NULL,
  "category" "AssetCategory" NOT NULL,
  "status" "AssetStatus" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Assignment" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assignedById" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "returnedAt" TIMESTAMP(3),
  "returnedById" TEXT,

  CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "diff" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User" ("email");
CREATE UNIQUE INDEX "Asset_tag_key" ON "Asset" ("tag");
CREATE UNIQUE INDEX "Asset_serialNumber_key" ON "Asset" ("serialNumber");

CREATE INDEX "Assignment_assetId_idx" ON "Assignment" ("assetId");
CREATE INDEX "Assignment_userId_idx" ON "Assignment" ("userId");
CREATE INDEX "Assignment_assignedById_idx" ON "Assignment" ("assignedById");
CREATE INDEX "Assignment_returnedById_idx" ON "Assignment" ("returnedById");
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog" ("actorId");
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog" ("entity", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");

CREATE UNIQUE INDEX "Assignment_one_active_per_asset"
ON "Assignment" ("assetId")
WHERE "returnedAt" IS NULL;

ALTER TABLE "Assignment"
ADD CONSTRAINT "Assignment_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "Asset"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Assignment"
ADD CONSTRAINT "Assignment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Assignment"
ADD CONSTRAINT "Assignment_assignedById_fkey"
FOREIGN KEY ("assignedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Assignment"
ADD CONSTRAINT "Assignment_returnedById_fkey"
FOREIGN KEY ("returnedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
