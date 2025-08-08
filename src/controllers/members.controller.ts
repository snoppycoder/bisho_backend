import express from 'express'
import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import {
	
	LoanApprovalStatus,
	RepaymentStatus,
	TransactionType,
} from "@prisma/client";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";
import { DateTime } from 'luxon';
import { getSession } from './auth/auth.js';



const membersRouter = express.Router();

membersRouter.get("/", async(req, res) => {
	const session = await getSession(req);
	
	if (!session ) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	const url = new URL(req.url);
	const effectiveDateStr = url.searchParams.get("effectiveDate");

	let effectiveDate: Date;
	let startDate: Date;
	let endDate: Date;
	if (effectiveDateStr) {
		// effectiveDate = parseISO(effectiveDateStr);
		effectiveDate = DateTime.fromISO(effectiveDateStr, { zone: 'utc' }).toJSDate();
	} else {
		// effectiveDate = new Date(); // Use current date if no effectiveDate is provided
		effectiveDate = DateTime.utc().toJSDate(); // Use current date in UTC
	}

	startDate = startOfMonth(effectiveDate);
	endDate = endOfMonth(effectiveDate);

	console.log("API: Effective Date:", effectiveDate.toISOString()); // Debug log
	console.log("API: Start Date:", startDate.toISOString()); // Debug log
	console.log("API: End Date:", endDate.toISOString()); // Debug log

	try {
		const members = await prisma.member.findMany({
			include: {
				balance: true,
				savings: {
					where: {
						savingsDate: {
							gte: startDate,
							lte: endDate,
						},
					},
					orderBy: { savingsDate: "desc" },
				},
				transactions: {
					where: {
						transactionDate: {
							gte: startDate,
							lte: endDate,
						},
					},
					orderBy: { transactionDate: "desc" },
				},
				loans: {
					where: {
						createdAt: {
							lte: endDate,
						},
					},
					include: {
						loanRepayments: {
							where: {
								repaymentDate: {
									gte: startDate,
									lte: endDate,
								},
							},
							orderBy: { repaymentDate: "desc" },
						},
					},
					orderBy: { createdAt: "desc" },
				},
			},
		});

		// Update the formattedMembers mapping function to correctly filter transactions by type
		const formattedMembers = members.map((member) => {
			// Find the most recent transaction for each type within the month
			const savingsTransaction = member.transactions.find(
				(t) => t.type === "SAVINGS"
			);
			const membershipFeeTransaction = member.transactions.find(
				(t) => t.type === "MEMBERSHIP_FEE"
			);
			const willingDepositTransaction = member.transactions.find(
				(t) => t.type === "WILLING_DEPOSIT"
			);
			const loanRepaymentTransaction = member.transactions.find(
				(t) => t.type === "LOAN_REPAYMENT"
			);

			// Calculate total contributions (sum of savings and loan repayments)
			const totalContributions =
				(savingsTransaction ? Number(savingsTransaction.amount) : 0) +
				(loanRepaymentTransaction
					? Number(loanRepaymentTransaction.amount)
					: 0);

			return {
				id: member.id,
				memberNumber: member.memberNumber,
				etNumber: member.etNumber,
				name: member.name,
				division: member.division,
				department: member.department,
				section: member.section,
				group: member.group,
				effectiveDate: startDate.toISOString(),
				balance: {
					totalSavings: savingsTransaction
						? Number(savingsTransaction.amount)
						: 0,
					totalContributions: totalContributions,
					membershipFee: membershipFeeTransaction
						? Number(membershipFeeTransaction.amount)
						: 0,
					willingDeposit: willingDepositTransaction
						? Number(willingDepositTransaction.amount)
						: 0,
					loanRepayments: loanRepaymentTransaction
						? Number(loanRepaymentTransaction.amount)
						: 0,
				},
			};
		});

		return res.json(formattedMembers);
	} catch (error) {
		console.error("Error fetching members:", error);
		return res.status(500).json(
			{ error: "Failed to fetch members" },
			
		);
	}


});

membersRouter.get("/loan-eligibility", async(req, res) => {
	const session = await getSession(req);
	
	if (!session ) {
		
		return res.status(401).json({ error: "Unauthorized" });
	}

	try {
		
		
		const member = await prisma.member.findUnique({
			where: { id: session.id! },
			include: {
				balance: true,
				loans: {
					where: {
						status: {
							in: ["PENDING", "APPROVED", "DISBURSED"],
						},
					},
				},
			},
		});

		if (!member) {
			return res.status(404).json({ error: "Member not found" });
		}
		const monthlySalary = 15000; // This should be fetched from member.salary or similar field

		const totalContribution = member.balance?.totalContributions || 0;
		const hasActiveLoan = member.loans.length > 0;

		return res.json({
			totalContribution: Number(totalContribution),
			monthlySalary,
			hasActiveLoan,
		});
	}
	catch(err) {
		console.log("Eligibility " +err)
		return res.json({error : err})
	}


});



export default  membersRouter