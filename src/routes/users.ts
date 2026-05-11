import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { prisma } from "../lib/prisma";

const router = Router();

const userRoleSchema = z.enum(["ADMIN", "IT_MANAGER", "IT_STAFF"]);

const createUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8),
  role: userRoleSchema,
});

const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "IT_MANAGER" | "IT_STAFF";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type AuditableUserField = "name" | "email" | "role" | "isActive";

function getRouteParam(param: string | string[] | undefined) {
  return Array.isArray(param) ? param[0] : param;
}

function getChangedFields(
  before: PublicUser,
  after: PublicUser,
  fields: AuditableUserField[],
) {
  const diff: Record<string, Prisma.InputJsonValue> = {};

  for (const field of fields) {
    if (before[field] !== after[field]) {
      diff[field] = {
        before: before[field],
        after: after[field],
      };
    }
  }

  return diff;
}

router.use(authenticate);

router.get("/", authorize(["ADMIN", "IT_MANAGER", "IT_STAFF"]), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: publicUserSelect,
    orderBy: { createdAt: "desc" },
  });

  return res.status(200).json({ users });
});

router.post("/", authorize(["ADMIN"]), async (req, res) => {
  const parsedBody = createUserSchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({
      message: "Invalid user payload",
      errors: parsedBody.error.flatten().fieldErrors,
    });
  }

  const { name, email, password, role } = parsedBody.data;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role,
        },
        select: publicUserSelect,
      });

      await tx.auditLog.create({
        data: {
          actorId: req.user!.userId,
          action: "CREATE",
          entity: "User",
          entityId: createdUser.id,
          diff: {
            before: null,
            after: JSON.parse(JSON.stringify(createdUser)),
          },
        },
      });

      return createdUser;
    });

    return res.status(201).json({ user });
  } catch {
    return res.status(409).json({ message: "Unable to create user" });
  }
});

router.get("/:id", authorize(["ADMIN", "IT_MANAGER"]), async (req, res) => {
  const userId = getRouteParam(req.params.id);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.status(200).json({ user });
});

router.patch("/:id", authorize(["ADMIN"]), async (req, res) => {
  const userId = getRouteParam(req.params.id);
  const parsedBody = updateUserSchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({
      message: "Invalid user update payload",
      errors: parsedBody.error.flatten().fieldErrors,
    });
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { id: userId },
        select: publicUserSelect,
      });

      if (!existingUser) {
        return null;
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: parsedBody.data,
        select: publicUserSelect,
      });

      const diff = getChangedFields(existingUser, updatedUser, [
        "name",
        "email",
        "role",
        "isActive",
      ]);

      await tx.auditLog.create({
        data: {
          actorId: req.user!.userId,
          action: "UPDATE",
          entity: "User",
          entityId: updatedUser.id,
          diff,
        },
      });

      return updatedUser;
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
  } catch {
    return res.status(409).json({ message: "Unable to update user" });
  }
});

export default router;
