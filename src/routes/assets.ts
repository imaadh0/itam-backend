import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

const router = Router();

const assetCategorySchema = z.enum([
  "LAPTOP",
  "DESKTOP",
  "MONITOR",
  "PHONE",
  "TABLET",
  "PERIPHERAL",
  "OTHER",
]);

const assetStatusSchema = z.enum([
  "AVAILABLE",
  "ASSIGNED",
  "UNDER_REPAIR",
  "RETIRED",
]);

const purchaseCostSchema = z.union([
  z.string().trim().min(1),
  z.number().finite().nonnegative(),
]);

const createAssetSchema = z.object({
  tag: z.string().trim().min(1),
  brand: z.string().trim().min(1),
  model: z.string().trim().min(1),
  serialNumber: z.string().trim().min(1),
  purchaseCost: purchaseCostSchema,
  category: assetCategorySchema,
  status: assetStatusSchema,
  notes: z.string().trim().optional().nullable(),
});

const updateAssetSchema = createAssetSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

const listAssetsQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: assetStatusSchema.optional(),
  category: assetCategorySchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const assetSelect = {
  id: true,
  tag: true,
  brand: true,
  model: true,
  serialNumber: true,
  purchaseCost: true,
  category: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
};

type AssetPayload = {
  id: string;
  tag: string;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseCost: Prisma.Decimal;
  category: "LAPTOP" | "DESKTOP" | "MONITOR" | "PHONE" | "TABLET" | "PERIPHERAL" | "OTHER";
  status: "AVAILABLE" | "ASSIGNED" | "UNDER_REPAIR" | "RETIRED";
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AuditableAssetField =
  | "tag"
  | "brand"
  | "model"
  | "serialNumber"
  | "purchaseCost"
  | "category"
  | "status"
  | "notes";

function getRouteParam(param: string | string[] | undefined) {
  return Array.isArray(param) ? param[0] : param;
}

function normalizeAssetInput<T extends { purchaseCost?: string | number }>(data: T) {
  return {
    ...data,
    purchaseCost:
      data.purchaseCost === undefined
        ? undefined
        : new Prisma.Decimal(data.purchaseCost),
  };
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function getChangedFields(
  before: AssetPayload,
  after: AssetPayload,
  fields: AuditableAssetField[],
) {
  const diff: Record<string, Prisma.InputJsonValue> = {};
  const beforeJson = toJsonValue(before) as Record<string, Prisma.InputJsonValue>;
  const afterJson = toJsonValue(after) as Record<string, Prisma.InputJsonValue>;

  for (const field of fields) {
    if (beforeJson[field] !== afterJson[field]) {
      diff[field] = {
        before: beforeJson[field],
        after: afterJson[field],
      };
    }
  }

  return diff;
}

router.use(authenticate);

router.get("/", authorize(["ADMIN", "IT_MANAGER", "IT_STAFF"]), async (req, res) => {
  const parsedQuery = listAssetsQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    return res.status(400).json({
      message: "Invalid asset query parameters",
      errors: parsedQuery.error.flatten().fieldErrors,
    });
  }

  const { search, status, category, page, limit } = parsedQuery.data;
  const where: Prisma.AssetWhereInput = {};

  if (status) {
    where.status = status;
  }

  if (category) {
    where.category = category;
  }

  if (search) {
    where.OR = [
      { brand: { contains: search, mode: "insensitive" } },
      { model: { contains: search, mode: "insensitive" } },
      { tag: { contains: search, mode: "insensitive" } },
    ];
  }

  const [assets, total] = await prisma.$transaction([
    prisma.asset.findMany({
      where,
      select: assetSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.asset.count({ where }),
  ]);

  return res.status(200).json({
    assets,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

router.post("/", authorize(["IT_MANAGER"]), async (req, res) => {
  const parsedBody = createAssetSchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({
      message: "Invalid asset payload",
      errors: parsedBody.error.flatten().fieldErrors,
    });
  }

  try {
    const asset = await prisma.$transaction(async (tx) => {
      const createdAsset = await tx.asset.create({
        data: normalizeAssetInput(parsedBody.data),
        select: assetSelect,
      });

      await tx.auditLog.create({
        data: {
          actorId: req.user!.userId,
          action: "CREATE",
          entity: "Asset",
          entityId: createdAsset.id,
          diff: {
            before: null,
            after: toJsonValue(createdAsset),
          },
        },
      });

      return createdAsset;
    });

    return res.status(201).json({ asset });
  } catch {
    return res.status(409).json({ message: "Unable to create asset" });
  }
});

router.get("/:id", authorize(["ADMIN", "IT_MANAGER", "IT_STAFF"]), async (req, res) => {
  const assetId = getRouteParam(req.params.id);

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      assignments: {
        orderBy: { assignedAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
          assignedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          returnedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!asset) {
    return res.status(404).json({ message: "Asset not found" });
  }

  return res.status(200).json({ asset });
});

router.patch("/:id", authorize(["IT_MANAGER"]), async (req, res) => {
  const assetId = getRouteParam(req.params.id);
  const parsedBody = updateAssetSchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({
      message: "Invalid asset update payload",
      errors: parsedBody.error.flatten().fieldErrors,
    });
  }

  try {
    const asset = await prisma.$transaction(async (tx) => {
      const existingAsset = await tx.asset.findUnique({
        where: { id: assetId },
        select: assetSelect,
      });

      if (!existingAsset) {
        return null;
      }

      const updatedAsset = await tx.asset.update({
        where: { id: assetId },
        data: normalizeAssetInput(parsedBody.data),
        select: assetSelect,
      });

      const diff = getChangedFields(existingAsset, updatedAsset, [
        "tag",
        "brand",
        "model",
        "serialNumber",
        "purchaseCost",
        "category",
        "status",
        "notes",
      ]);

      await tx.auditLog.create({
        data: {
          actorId: req.user!.userId,
          action: "UPDATE",
          entity: "Asset",
          entityId: updatedAsset.id,
          diff,
        },
      });

      return updatedAsset;
    });

    if (!asset) {
      return res.status(404).json({ message: "Asset not found" });
    }

    return res.status(200).json({ asset });
  } catch {
    return res.status(409).json({ message: "Unable to update asset" });
  }
});

router.delete("/:id", authorize(["IT_MANAGER"]), async (req, res) => {
  const assetId = getRouteParam(req.params.id);

  try {
    const deletedAsset = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({
        where: { id: assetId },
        select: assetSelect,
      });

      if (!asset) {
        return { status: "not_found" as const };
      }

      if (asset.status !== "AVAILABLE") {
        return { status: "not_available" as const };
      }

      const activeAssignment = await tx.assignment.findFirst({
        where: {
          assetId,
          returnedAt: null,
        },
        select: { id: true },
      });

      if (activeAssignment) {
        return { status: "assigned" as const };
      }

      await tx.asset.delete({
        where: { id: assetId },
      });

      await tx.auditLog.create({
        data: {
          actorId: req.user!.userId,
          action: "DELETE",
          entity: "Asset",
          entityId: asset.id,
          diff: {
            before: toJsonValue(asset),
            after: null,
          },
        },
      });

      return { status: "deleted" as const, asset };
    });

    if (deletedAsset.status === "not_found") {
      return res.status(404).json({ message: "Asset not found" });
    }

    if (deletedAsset.status === "not_available" || deletedAsset.status === "assigned") {
      return res.status(400).json({
        message: "Only available assets with no active assignment can be deleted",
      });
    }

    return res.status(200).json({ asset: deletedAsset.asset });
  } catch {
    return res.status(409).json({
      message: "Unable to delete asset. Assets with assignment history cannot be deleted.",
    });
  }
});

export default router;
