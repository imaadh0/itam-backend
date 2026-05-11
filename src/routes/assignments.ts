import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

const router = Router();

const assignmentBodySchema = z.object({
  assetId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
});

const assignmentQuerySchema = z.object({
  assetId: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
});

const assignmentInclude = {
  asset: {
    select: {
      id: true,
      tag: true,
      brand: true,
      model: true,
      serialNumber: true,
      category: true,
      status: true,
    },
  },
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
};

function getRouteParam(param: string | string[] | undefined) {
  return Array.isArray(param) ? param[0] : param;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

router.use(authenticate);

router.post("/", authorize(["IT_MANAGER", "IT_STAFF"]), async (req, res) => {
  const parsedBody = assignmentBodySchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({
      message: "Invalid assignment payload",
      errors: parsedBody.error.flatten().fieldErrors,
    });
  }

  const { assetId, userId } = parsedBody.data;

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const [asset, user, activeAssignment] = await Promise.all([
        tx.asset.findUnique({
          where: { id: assetId },
          select: { id: true, status: true },
        }),
        tx.user.findUnique({
          where: { id: userId },
          select: { id: true, isActive: true },
        }),
        tx.assignment.findFirst({
          where: {
            assetId,
            returnedAt: null,
          },
          select: { id: true },
        }),
      ]);

      if (!asset) {
        return { status: "asset_not_found" as const };
      }

      if (!user) {
        return { status: "user_not_found" as const };
      }

      if (!user.isActive) {
        return { status: "user_inactive" as const };
      }

      if (activeAssignment) {
        return { status: "conflict" as const };
      }

      const assignment = await tx.assignment.create({
        data: {
          assetId,
          userId,
          assignedById: req.user!.userId,
        },
        include: assignmentInclude,
      });

      await tx.asset.update({
        where: { id: assetId },
        data: { status: "ASSIGNED" },
      });

      await tx.auditLog.create({
        data: {
          actorId: req.user!.userId,
          action: "CREATE",
          entity: "Assignment",
          entityId: assignment.id,
          diff: {
            before: null,
            after: toJsonValue(assignment),
          },
        },
      });

      return { status: "created" as const, assignment };
    });

    if (result.status === "asset_not_found") {
      return res.status(404).json({ message: "Asset not found" });
    }

    if (result.status === "user_not_found") {
      return res.status(404).json({ message: "User not found" });
    }

    if (result.status === "user_inactive") {
      return res.status(400).json({ message: "Cannot assign asset to an inactive user" });
    }

    if (result.status === "conflict") {
      return res.status(409).json({ message: "Asset already has an active assignment" });
    }

    return res.status(201).json({ assignment: result.assignment });
  } catch {
    return res.status(409).json({ message: "Unable to create assignment" });
  }
});

router.patch("/:id/return", authorize(["IT_MANAGER", "IT_STAFF"]), async (req, res) => {
  const assignmentId = getRouteParam(req.params.id);

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existingAssignment = await tx.assignment.findUnique({
        where: { id: assignmentId },
        include: assignmentInclude,
      });

      if (!existingAssignment) {
        return { status: "not_found" as const };
      }

      if (existingAssignment.returnedAt) {
        return { status: "already_returned" as const };
      }

      const returnedAssignment = await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          returnedAt: new Date(),
          returnedById: req.user!.userId,
        },
        include: assignmentInclude,
      });

      await tx.asset.update({
        where: { id: returnedAssignment.assetId },
        data: { status: "AVAILABLE" },
      });

      await tx.auditLog.create({
        data: {
          actorId: req.user!.userId,
          action: "RETURN",
          entity: "Assignment",
          entityId: returnedAssignment.id,
          diff: {
            before: toJsonValue(existingAssignment),
            after: toJsonValue(returnedAssignment),
          },
        },
      });

      return { status: "returned" as const, assignment: returnedAssignment };
    });

    if (result.status === "not_found") {
      return res.status(404).json({ message: "Assignment not found" });
    }

    if (result.status === "already_returned") {
      return res.status(409).json({ message: "Assignment has already been returned" });
    }

    return res.status(200).json({ assignment: result.assignment });
  } catch {
    return res.status(409).json({ message: "Unable to return assignment" });
  }
});

router.get("/", authorize(["ADMIN", "IT_MANAGER", "IT_STAFF"]), async (req, res) => {
  const parsedQuery = assignmentQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    return res.status(400).json({
      message: "Invalid assignment query parameters",
      errors: parsedQuery.error.flatten().fieldErrors,
    });
  }

  const where: Prisma.AssignmentWhereInput = {};

  if (parsedQuery.data.assetId) {
    where.assetId = parsedQuery.data.assetId;
  }

  if (parsedQuery.data.userId) {
    where.userId = parsedQuery.data.userId;
  }

  const assignments = await prisma.assignment.findMany({
    where,
    include: assignmentInclude,
    orderBy: { assignedAt: "desc" },
  });


  return res.status(200).json({ assignments });
});

export default router;
