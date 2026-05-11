import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const users = [
  {
    name: "Admin User",
    email: "admin@itam.com",
    password: "admin123",
    role: "ADMIN" as const,
  },
  {
    name: "IT Manager",
    email: "manager@itam.com",
    password: "manager123",
    role: "IT_MANAGER" as const,
  },
  {
    name: "IT Staff",
    email: "staff@itam.com",
    password: "staff123",
    role: "IT_STAFF" as const,
  },
];

const assets = [
  {
    tag: "ITAM-LAP-001",
    brand: "Dell",
    model: "Latitude 5440",
    serialNumber: "DL-LAT-5440-001",
    purchaseCost: "1199.00",
    category: "LAPTOP" as const,
    status: "AVAILABLE" as const,
    notes: "Primary laptop stock",
  },
  {
    tag: "ITAM-LAP-002",
    brand: "Lenovo",
    model: "ThinkPad T14",
    serialNumber: "LN-T14-002",
    purchaseCost: "1299.00",
    category: "LAPTOP" as const,
    status: "ASSIGNED" as const,
    notes: "Assigned to engineering pool",
  },
  {
    tag: "ITAM-DSK-001",
    brand: "HP",
    model: "EliteDesk 800",
    serialNumber: "HP-ED800-001",
    purchaseCost: "899.00",
    category: "DESKTOP" as const,
    status: "AVAILABLE" as const,
    notes: null,
  },
  {
    tag: "ITAM-MON-001",
    brand: "Dell",
    model: "UltraSharp U2723QE",
    serialNumber: "DL-U2723QE-001",
    purchaseCost: "579.00",
    category: "MONITOR" as const,
    status: "ASSIGNED" as const,
    notes: "27 inch 4K monitor",
  },
  {
    tag: "ITAM-MON-002",
    brand: "LG",
    model: "27QN880-B",
    serialNumber: "LG-27QN880-002",
    purchaseCost: "449.00",
    category: "MONITOR" as const,
    status: "UNDER_REPAIR" as const,
    notes: "Stand replacement pending",
  },
  {
    tag: "ITAM-PHN-001",
    brand: "Apple",
    model: "iPhone 15",
    serialNumber: "APL-IP15-001",
    purchaseCost: "799.00",
    category: "PHONE" as const,
    status: "AVAILABLE" as const,
    notes: null,
  },
  {
    tag: "ITAM-PHN-002",
    brand: "Samsung",
    model: "Galaxy S24",
    serialNumber: "SMS-S24-002",
    purchaseCost: "859.00",
    category: "PHONE" as const,
    status: "RETIRED" as const,
    notes: "Retired test device",
  },
  {
    tag: "ITAM-TAB-001",
    brand: "Apple",
    model: "iPad Air",
    serialNumber: "APL-IPADAIR-001",
    purchaseCost: "599.00",
    category: "TABLET" as const,
    status: "AVAILABLE" as const,
    notes: "Shared meeting room tablet",
  },
  {
    tag: "ITAM-PER-001",
    brand: "Logitech",
    model: "MX Keys",
    serialNumber: "LOG-MXKEYS-001",
    purchaseCost: "119.00",
    category: "PERIPHERAL" as const,
    status: "ASSIGNED" as const,
    notes: "Wireless keyboard",
  },
  {
    tag: "ITAM-OTH-001",
    brand: "APC",
    model: "Back-UPS Pro 1500",
    serialNumber: "APC-BR1500-001",
    purchaseCost: "249.00",
    category: "OTHER" as const,
    status: "AVAILABLE" as const,
    notes: "UPS unit",
  },
];

const assignments = [
  {
    assetTag: "ITAM-LAP-002",
    userEmail: "staff@itam.com",
    assignedByEmail: "manager@itam.com",
    assignedAt: new Date("2026-05-01T09:00:00.000Z"),
  },
  {
    assetTag: "ITAM-MON-001",
    userEmail: "manager@itam.com",
    assignedByEmail: "admin@itam.com",
    assignedAt: new Date("2026-05-03T10:30:00.000Z"),
  },
  {
    assetTag: "ITAM-PER-001",
    userEmail: "staff@itam.com",
    assignedByEmail: "manager@itam.com",
    assignedAt: new Date("2026-05-05T14:15:00.000Z"),
  },
];

async function main() {
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 12);

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        passwordHash,
        role: user.role,
        isActive: true,
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
      },
    });
  }

  for (const asset of assets) {
    await prisma.asset.upsert({
      where: { tag: asset.tag },
      update: asset,
      create: asset,
    });
  }

  for (const assignment of assignments) {
    const [asset, user, assignedBy] = await Promise.all([
      prisma.asset.findUnique({ where: { tag: assignment.assetTag } }),
      prisma.user.findUnique({ where: { email: assignment.userEmail } }),
      prisma.user.findUnique({ where: { email: assignment.assignedByEmail } }),
    ]);

    if (!asset || !user || !assignedBy) {
      throw new Error(`Unable to seed assignment for ${assignment.assetTag}`);
    }

    const activeAssignment = await prisma.assignment.findFirst({
      where: {
        assetId: asset.id,
        returnedAt: null,
      },
    });

    if (!activeAssignment) {
      await prisma.assignment.create({
        data: {
          assetId: asset.id,
          userId: user.id,
          assignedById: assignedBy.id,
          assignedAt: assignment.assignedAt,
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
