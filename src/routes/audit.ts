import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

const router = Router();

const auditQuerySchema = z.object({
  entity: z.string().trim().min(1).optional(),
  entityId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

router.use(authenticate);

router.get("/", authorize(["IT_MANAGER"]), async (req, res) => {
  const parsedQuery = auditQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    return res.status(400).json({
      message: "Invalid audit query parameters",
      errors: parsedQuery.error.flatten().fieldErrors,
    });
  }

  const { entity, entityId, page, limit } = parsedQuery.data;
  const where: Prisma.AuditLogWhereInput = {};

  if (entity) {
    where.entity = entity;
  }

  if (entityId) {
    where.entityId = entityId;
  }

  const [auditLogs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return res.status(200).json({
    auditLogs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export default router;
