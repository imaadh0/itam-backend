import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsedBody = loginSchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({
      message: "Invalid login payload",
      errors: parsedBody.error.flatten().fieldErrors,
    });
  }

  const { email, password } = parsedBody.data;
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      role: true,
      passwordHash: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    return res.status(500).json({ message: "JWT secret is not configured" });
  }

  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      name: user.name,
    },
    jwtSecret,
    { expiresIn: "1d" },
  );

  return res.status(200).json({ token });
});

export default router;
