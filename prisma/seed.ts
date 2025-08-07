import dotenv from 'dotenv'
import { prisma } from '../config/prisma.js';
import bcrypt from 'bcrypt';


async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);

  const users = await prisma.user.createMany({
    data: [
      { name: 'Alice Accountant', email: 'alice@demo.com', phone: '1001', password: hashedPassword, role: 'ACCOUNTANT' },
      { name: 'Mark Manager', email: 'mark@demo.com', phone: '1002', password: hashedPassword, role: 'MANAGER' },
      { name: 'Sam Supervisor', email: 'sam@demo.com', phone: '1003', password: hashedPassword, role: 'SUPERVISOR' },
      { name: 'Cathy Committee', email: 'cathy@demo.com', phone: '1004', password: hashedPassword, role: 'COMMITTEE' },
      { name: 'Mia Member', email: 'mia@demo.com', phone: '1005', password: hashedPassword, role: 'MEMBER' },
    ],
  });

  const mia = await prisma.user.findUnique({ where: { email: 'mia@demo.com' } });

  if (!mia) {
    throw new Error("User 'mia@demo.com' not found.");
  }

  const member = await prisma.member.create({
    data: {
      name: 'Mia Member',
      memberNumber: 101,
      etNumber: 202,
      email: 'mia@demo.com',
      phone: '1005',
      division: 'Finance',
      department: 'Accounts',
      section: 'Loans',
      group: 'East Wing',
      userId: mia.id,
    },
  });

  await prisma.loan.create({
    data: {
      memberId: member.id,
      amount: 50000,
      interestRate: 5.5,
      tenureMonths: 12,
      status: 'PENDING',
    },
  });

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
