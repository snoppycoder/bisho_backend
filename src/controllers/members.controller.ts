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
import { getSession, getUserFromRequest } from './auth/auth.js';
import { Account, MemberData } from '../model/model.js';
import { createJournalEntry, mapToAccountingType } from '../utils/createJournal.js';
import { handleLoanRepayment } from '../utils/handleloanRepayment.js';



const membersRouter = express.Router();

membersRouter.get("/", async(req, res) => {
	const session = await getSession(req);
	
	if (!session || session.role === 'MEMBER' ) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	// const url = new URL(req.url);
	const url = new URL(req.url, `http://${req.headers.host}`);
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
// membersRouter.post("/kyc-upload", async (req, res) => {

// });
// membersRouter.post('/import', async (req, res ) => {
// 	const ODOO_CONFIG = {
// 	host: "116.202.104.180",
// 	port: 8069,
// 	db: "test",
// 	username: "admin",
// 	password: "admin",
// 	commonPath: "/xmlrpc/2/common",
// 	objectPath: "/xmlrpc/2/object",
// };

// const ACCOUNTS: Record<string, Account> = {
// 	cash: { id: 102, code: "211002", name: "Cash", account_type: "asset_cash" },
// 	bank: { id: 101, code: "211001", name: "Bank", account_type: "asset_cash" },
// 	tradeDebtors: {
// 		id: 9,
// 		code: "221100",
// 		name: "Trade Debtors",
// 		account_type: "asset_receivable",
// 	},
// 	suspense: {
// 		id: 5,
// 		code: "220100",
// 		name: "Suspense",
// 		account_type: "asset_receivable",
// 	},
// 	otherDeposits: {
// 		id: 38,
// 		code: "305400",
// 		name: "Other deposits",
// 		account_type: "liability_current",
// 	},
// 	commercialLoan: {
// 		id: 40,
// 		code: "310300",
// 		name: "Commercial Loan",
// 		account_type: "liability_current",
// 	},
// 	salesIncome: {
// 		id: 1,
// 		code: "110000",
// 		name: "Sales of Goods and Services",
// 		account_type: "income",
// 	},
// 	exchangeGain: {
// 		id: 98,
// 		code: "120000",
// 		name: "Foreign Exchange Currency Gain Account",
// 		account_type: "income_other",
// 	},
// 	interestExpense: {
// 		id: 97,
// 		code: "643400",
// 		name: "Payments of interest and bank charges on local debt",
// 		account_type: "expense",
// 	},
// 	feeExpense: {
// 		id: 81,
// 		code: "625600",
// 		name: "Fees and charges",
// 		account_type: "expense",
// 	},
// 	equity: {
// 		id: 42,
// 		code: "401000",
// 		name: "Share capital / equity",
// 		account_type: "equity",
// 	},
// 	undistributedProfits: {
// 		id: 109,
// 		code: "999999",
// 		name: "Undistributed Profits/Losses",
// 		account_type: "equity_unaffected",
// 	},
// 	cashDifferenceGain: {
// 		id: 106,
// 		code: "999001",
// 		name: "Cash Difference Gain",
// 		account_type: "income_other",
// 	},
// 	cashDifferenceLoss: {
// 		id: 107,
// 		code: "999002",
// 		name: "Cash Difference Loss",
// 		account_type: "expense",
// 	},
// };
// try {
// 		const membersData: MemberData[] = await req.body;
// 		const skipped: string[] = [];
// 		const failed: string[] = [];
// 		const importedCount = await prisma.$transaction(
// 			async (prisma) => {
// 				let count = 0;
// 				const safeAmount = (val: any) => Number(val) || 0;

// 				for (const memberData of membersData) {
// 					const memberNumber = memberData["Employee Number"];
// 					const etNumber = memberData["ET Number"];

// 					if (isNaN(memberNumber) || isNaN(etNumber)) {
// 						console.error(
// 							`Invalid member number or ET number for member: ${memberData.Name}`
// 						);
// 						skipped.push(memberData.Name);
// 						continue;
// 					}

// 					const jsDate = new Date(
// 						(memberData["Effective Date"] - 25569) * 86400 * 1000
// 					);

// 					// Upsert member
// 					const member = await prisma.member.upsert({
// 						where: { etNumber },
// 						update: {
// 							etNumber,
// 							name: memberData.Name,
// 							division: memberData.Division,
// 							department: memberData.Department || null,
// 							section: memberData.Section,
// 							group: memberData.Group,
// 						},
// 						create: {
// 							memberNumber,
// 							etNumber,
// 							name: memberData.Name,
// 							division: memberData.Division,
// 							department: memberData.Department || null,
// 							section: memberData.Section,
// 							group: memberData.Group,
// 						},
// 					});

// 					// Create or update MemberBalance
// 					await prisma.memberBalance.upsert({
// 						where: { memberId: member.id },
// 						update: {
// 							totalSavings: {
// 								increment: memberData["Credit Association Savings"],
// 							},
// 							costOfShare: {
// 								increment: memberData["Credit Association Cost of Share"],
// 							},
// 							registrationFee: {
// 								increment: memberData["Credit Association Registration Fee"],
// 							},
// 							membershipFee: {
// 								increment: memberData["Credit Association Membership Fee"],
// 							},
// 							willingDeposit: {
// 								increment: memberData["Credit Association Willing Deposit"],
// 							},
// 							totalContributions:
// 								safeAmount(memberData["Credit Association Savings"]) +
// 								safeAmount(memberData["Credit Association Cost of Share"]) +
// 								safeAmount(memberData["Credit Association Registration Fee"]) +
// 								safeAmount(memberData["Credit Association Purchases"]) +
// 								safeAmount(memberData["Credit Association Loan Repayment"]),
// 						},
// 						create: {
// 							memberId: member.id,
// 							totalSavings: memberData["Credit Association Savings"],
// 							costOfShare: memberData["Credit Association Cost of Share"],
// 							registrationFee:
// 								memberData["Credit Association Registration Fee"],
// 							membershipFee: memberData["Credit Association Membership Fee"],
// 							willingDeposit: memberData["Credit Association Willing Deposit"],
// 							totalContributions:
// 								memberData["Credit Association Savings"] +
// 								memberData["Credit Association Cost of Share"] +
// 								memberData["Credit Association Registration Fee"] +
// 								memberData["Credit Association Purchases"] +
// 								memberData["Credit Association Loan Repayment"],
// 						},
// 					});

// 					// Handle loan repayment
// 					if (memberData["Credit Association Loan Repayment"] > 0) {
// 						try {
// 							await handleLoanRepayment(
// 								prisma,
// 								member.id,
// 								memberData["Credit Association Loan Repayment"],
// 								jsDate,
// 								"ERP_PAYROLL", // sourceType
// 								`BULK_IMPORT_${jsDate.getTime()}`
// 							);
// 						} catch (error) {
// 							// return;
// 							// console.error(
// 							// 	`Error processing loan repayment for member ${member.name}:`,
// 							// 	error
// 							// );
// 							// Consider how you want to handle this error (e.g., continue processing other members or throw)
// 						}
// 					}

// 					// Create transactions
// 					const transactions = [
// 						{
// 							type: "SAVINGS",
// 							amount: memberData["Credit Association Savings"],
// 						},
// 						{
// 							type: "MEMBERSHIP_FEE",
// 							amount: memberData["Credit Association Membership Fee"],
// 						},
// 						{
// 							type: "REGISTRATION_FEE",
// 							amount: memberData["Credit Association Registration Fee"],
// 						},
// 						{
// 							type: "COST_OF_SHARE",
// 							amount: memberData["Credit Association Cost of Share"],
// 						},
// 						{
// 							type: "PURCHASE",
// 							amount: memberData["Credit Association Purchases"],
// 						},
// 						{
// 							type: "WILLING_DEPOSIT",
// 							amount: memberData["Credit Association Willing Deposit"],
// 						},
// 					];

// 					const filteredTransactions = transactions.filter((t) => t.amount > 0);

// 					await prisma.transaction.createMany({
// 						data: filteredTransactions.map((t) => ({
// 							memberId: member.id,
// 							type: t.type as TransactionType,
// 							amount: t.amount,
// 							transactionDate: jsDate,
// 						})),
// 					});

// 					const currentDate = new Date().toISOString().split("T")[0];

// 					for (const tx of filteredTransactions) {
// 						await createJournalEntry({
// 							type: mapToAccountingType(tx.type as TransactionType),
// 							amount: Number(tx.amount),
// 							interest: 50,
// 							date: currentDate,
// 							reference: `REF-${tx.type.toString()}-${member.name.toString()}-${currentDate}`,
// 							journalId: 3,
// 						});
// 					}

// 					count++;
// 				}

// 				return count;
// 			},
// 			{ timeout: 50000 }
// 		);

// 		return res.json({ importedCount, skipped, failed }); 
// 	}
// 		catch(error) {
// 			console.error("Error importing members:", error);
// 			return res.json(
// 			{ error: "Failed to import members", details: error })
// 		}

// });
membersRouter.post("/import", async (req, res) => {
  try {
	const session = await getSession(req);

    if (!session || session.role === 'MEMBER' ) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	const membersData = req.body

    // Read Excel file
    
    const skipped: string[] = [];
    const failed: string[] = [];
    let importedCount = 0;

    // Process each member sequentially to avoid transaction timeout
    for (const memberData of membersData) {
      try {
        const memberNumber = Number(memberData["Employee Number"]);
        const etNumber = Number(memberData["ET Number"]);
        if (isNaN(memberNumber) || isNaN(etNumber)) {
          skipped.push(memberData.Name);
          continue;
        }

        const jsDate = new Date((memberData["Effective Date"] - 25569) * 86400 * 1000);

        // Upsert member
        const member = await prisma.member.upsert({
          where: { etNumber },
          update: {
            etNumber,
            name: memberData.Name,
            division: memberData.Division,
            department: memberData.Department || null,
            section: memberData.Section,
            group: memberData.Group,
          },
          create: {
            memberNumber,
            etNumber,
            name: memberData.Name,
            division: memberData.Division,
            department: memberData.Department || null,
            section: memberData.Section,
            group: memberData.Group,
          },
        });

        // Upsert member balance
        const safeAmount = (val: any) => Number(val) || 0;
        await prisma.memberBalance.upsert({
          where: { memberId: member.id },
          update: {
            totalSavings: { increment: safeAmount(memberData["Credit Association Savings"]) },
            costOfShare: { increment: safeAmount(memberData["Credit Association Cost of Share"]) },
            registrationFee: { increment: safeAmount(memberData["Credit Association Registration Fee"]) },
            membershipFee: { increment: safeAmount(memberData["Credit Association Membership Fee"]) },
            willingDeposit: { increment: safeAmount(memberData["Credit Association Willing Deposit"]) },
            totalContributions:
              safeAmount(memberData["Credit Association Savings"]) +
              safeAmount(memberData["Credit Association Cost of Share"]) +
              safeAmount(memberData["Credit Association Registration Fee"]) +
              safeAmount(memberData["Credit Association Purchases"]) +
              safeAmount(memberData["Credit Association Loan Repayment"]),
          },
          create: {
            memberId: member.id,
            totalSavings: safeAmount(memberData["Credit Association Savings"]),
            costOfShare: safeAmount(memberData["Credit Association Cost of Share"]),
            registrationFee: safeAmount(memberData["Credit Association Registration Fee"]),
            membershipFee: safeAmount(memberData["Credit Association Membership Fee"]),
            willingDeposit: safeAmount(memberData["Credit Association Willing Deposit"]),
            totalContributions:
              safeAmount(memberData["Credit Association Savings"]) +
              safeAmount(memberData["Credit Association Cost of Share"]) +
              safeAmount(memberData["Credit Association Registration Fee"]) +
              safeAmount(memberData["Credit Association Purchases"]) +
              safeAmount(memberData["Credit Association Loan Repayment"]),
          },
        });

        // Handle loan repayment if needed
        if (safeAmount(memberData["Credit Association Loan Repayment"]) > 0) {
          await handleLoanRepayment(
            prisma,
            member.id,
            safeAmount(memberData["Credit Association Loan Repayment"]),
            jsDate,
            "ERP_PAYROLL",
            `BULK_IMPORT_${jsDate.getTime()}`
          );
        }

        importedCount++;
      } catch (err) {
        failed.push(memberData.Name);
        console.error(`Error importing member ${memberData.Name}:`, err);
      }
    }

    return res.json({ importedCount, skipped, failed });
  } catch (error) {
    console.error("Error importing members:", error);
    return res.status(500).json({ error: "Failed to import members", details: error });
  }
});
membersRouter.get('/loans', async(req, res) => {
	const session = await getSession(req);

	if (!session || session.role !== "MEMBER" || !session.id) {
		return res.status(401).json("Unauthroized");

	}
	try {
		const loans = await prisma.loan.findMany({
			where: {
				memberId: session.id,
			},
			include: {
				approvalLogs: {
					select: {
						id: true,
						status: true,
						approvalDate: true,
						comments: true,
						role: true,
					},
					orderBy: {
						approvalDate: "desc",
					},
				},
				loanRepayments: {
					select: {
						id: true,
						amount: true,
						repaymentDate: true,
						reference: true,
						sourceType: true,
						status: true,
					},
					orderBy: {
						repaymentDate: "asc",
					},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		return res.json(loans);

	}
	catch(error) {
		console.error("Error fetching loan details:", error);
		return res.status(500).json(
			{
				error: "Failed to fetch loans",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			
		);

	}

});
membersRouter.get("/loan-eligibility", async(req, res) => {
	const session = await getSession(req);
	console.log(req.body)
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
		const monthlySalary = member.salary; // This should be fetched from member.salary or similar field
		const totalContribution = member.balance?.totalContributions || 0; // this will become 0 coelecing will return 0
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
membersRouter.get("/:etNumber/savings-and-transactions", async (req, res) => {
	const session = await getSession(req);
	if (!session) {
		return res.status(401).json("Unauthroized");
	}
	
	const etNumber = req.params.etNumber;
	if (
		!session ||
		session.role !== "MEMBER" ||
		session?.etNumber?.toString() !== etNumber
	) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	try {
		// Get the query parameters for filtering
		const url = new URL(req.url, `${req.protocol}://${req.get('host')}`);
		const period = url.searchParams.get("period") || "all";
		const type = url.searchParams.get("type") || "all";

		// Calculate date range based on period
		let startDate: Date | undefined;
		const now = new Date();

		if (period === "week") {
			startDate = new Date(now);
			startDate.setDate(now.getDate() - 7);
		} else if (period === "month") {
			startDate = new Date(now);
			startDate.setMonth(now.getMonth() - 1);
		} else if (period === "year") {
			startDate = new Date(now);
			startDate.setFullYear(now.getFullYear() - 1);
		}

		// Build the where clause for transactions
		
		const member = await prisma.member.findUnique({
			where: { etNumber: Number.parseInt(etNumber) },
		});
		if (!member) {
			return res.status(404).json({ error: "Member not found" });
		}
		const transactions = await prisma.transaction.findMany({
			where: {
				memberId: member.id,
			},
			orderBy: { transactionDate: "desc" },
		});
		const savingsTransactions = transactions.filter(
			(t: any) => t.type === "SAVINGS"
		);

		console.log({
			savingsTransactions,
		});

		const withdrawalTransactions = transactions.filter(
			(t: any) => t.type === "WITHDRAWAL"
		);

		const totalDeposits = savingsTransactions.reduce(
			(sum, t) => sum + Number(t.amount),
			0
		);

		const totalWithdrawals = withdrawalTransactions.reduce(
			(sum, t) => sum + Number(t.amount),
			0
		);

		const totalSavings = totalDeposits - totalWithdrawals;

		// Get monthly savings data for chart
		const last6Months = Array.from({ length: 6 }, (_, i) => {
			const date = new Date();
			date.setMonth(date.getMonth() - i);
			return {
				month: date.toLocaleString("default", { month: "short" }),
				year: date.getFullYear(),
				monthIndex: date.getMonth(),
				fullYear: date.getFullYear(),
			};
		}).reverse();

		const monthlySavings = await Promise.all(
			last6Months.map(async ({ month, year, monthIndex, fullYear }) => {
				const startOfMonth = new Date(fullYear, monthIndex, 1);
				const endOfMonth = new Date(fullYear, monthIndex + 1, 0);

				const monthlyDeposits = await prisma.transaction.findMany({
					where: {
						memberId: Number.parseInt(etNumber),
						type: { in: ["MEMBERSHIP_FEE", "WILLING_DEPOSIT", "SAVINGS"] },
						transactionDate: {
							gte: startOfMonth,
							lte: endOfMonth,
						},
					},
				});

				const monthlyWithdrawals = await prisma.transaction.findMany({
					where: {
						memberId: Number.parseInt(etNumber),
						type: "LOAN_REPAYMENT",
						transactionDate: {
							gte: startOfMonth,
							lte: endOfMonth,
						},
					},
				});

				const deposits = monthlyDeposits.reduce(
					(sum, t) => sum + Number(t.amount),
					0
				);
				const withdrawals = monthlyWithdrawals.reduce(
					(sum, t) => sum + Number(t.amount),
					0
				);

				return {
					month: `${month} ${year}`,
					deposits,
					withdrawals,
					net: deposits - withdrawals,
				};
			})
		);

		// Get transaction type distribution for pie chart
		const transactionTypes = await prisma.transaction.groupBy({
			by: ["type"],
			where: {
				memberId: Number.parseInt(etNumber),
			},
			_sum: {
				amount: true,
			},
		});

		const typeDistribution = transactionTypes.map((type) => ({
			name: type.type,
			value: Number(type._sum.amount) || 0,
		}));

		return res.json({
			totalSavings,
			totalDeposits,
			totalWithdrawals,
			recentTransactions: transactions.slice(0, 10),
			monthlySavings,
			typeDistribution,
			transactionCount: transactions.length,
		});



	}
	catch(error) {
		console.error("Error fetching member details:", error);
		return res.status(500).json(
			{
				error: "Failed to fetch member details",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			
		);

	}


});

membersRouter.get("/:etNumber", async(req, res) => {
	const etNumber = Number.parseInt(req.params.etNumber);
	console.log(req.originalUrl)
	if (isNaN(etNumber)) {
		console.log(etNumber)
		return res.status(400).json(
			{ error: "Invalid ET Number format" },
			
		);
	}
	const session = await getSession(req);
	if (!session ) {

		return res.status(401).json({ error: "Unauthorized" });
	}
	console.log(etNumber)
	try {
		const member = await prisma.member.findUnique({
			where: { etNumber },
			include: {
				balance: true,
				savings: {
					orderBy: { savingsDate: "desc" },
				},
				loans: {
					include: {
						loanRepayments: {
							orderBy: { repaymentDate: "desc" },
						},
					},
					orderBy: { createdAt: "desc" },
				},
				transactions: {
					orderBy: { transactionDate: "desc" },
				},
			},
		});
		console.log(member)

		if (!member) {
			return res.status(404).json(
				{ error: "Member not found" },
				
			);
		}

		// Define transaction types for better maintainability
		const TransactionType = {
			SAVINGS: "SAVINGS",
			MEMBERSHIP_FEE: "MEMBERSHIP_FEE",
			LOAN_REPAYMENT: "LOAN_REPAYMENT",
			WILLING_DEPOSIT: "WILLING_DEPOSIT",
			REGISTRATION_FEE: "REGISTRATION_FEE",
			COST_OF_SHARE: "COST_OF_SHARE",
		};

		// Helper function to calculate total amount for a specific transaction type
		const calculateTotalByType = (type: any) => {
			return member.transactions
				.filter((transaction) => transaction.type === type)
				.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
		};

		// Helper function to get the latest transaction of a specific type
		const getLatestTransactionByType = (type: any) => {
			return member.transactions
				.filter((transaction) => transaction.type === type)
				.sort(
					(a, b) =>
						new Date(b.transactionDate).getTime() -
						new Date(a.transactionDate).getTime()
				)[0];
		};

		// Calculate financial metrics
		const totalSavings = calculateTotalByType(TransactionType.SAVINGS);
		const totalLoanRepayment = calculateTotalByType(
			TransactionType.LOAN_REPAYMENT
		);
		const totalMembershipFee = calculateTotalByType(
			TransactionType.MEMBERSHIP_FEE
		);
		const totalWillingDeposit = calculateTotalByType(
			TransactionType.WILLING_DEPOSIT
		);
		const totalRegistrationFee = calculateTotalByType(
			TransactionType.REGISTRATION_FEE
		);
		const totalCostOfShare = calculateTotalByType(
			TransactionType.COST_OF_SHARE
		);

		// Calculate total contributions
		const contributionTypes = [
			TransactionType.SAVINGS,
			TransactionType.MEMBERSHIP_FEE,
			TransactionType.LOAN_REPAYMENT,
			TransactionType.WILLING_DEPOSIT,
		];

		const totalContributions = member.transactions
			.filter((transaction) => contributionTypes.includes(transaction.type))
			.reduce((sum, transaction) => sum + Number(transaction.amount), 0);

		// Get latest transactions
		const lastSavingsTransaction = getLatestTransactionByType(
			TransactionType.SAVINGS
		);
		const lastContributionTransaction = member.transactions
			.filter((transaction) => contributionTypes.includes(transaction.type))
			.sort(
				(a, b) =>
					new Date(b.transactionDate).getTime() -
					new Date(a.transactionDate).getTime()
			)[0];

		// Calculate loan metrics
		const activeLoans = member.loans.filter(
			(loan) => loan.status === ("DISBURSED" as LoanApprovalStatus)
		).length;

		const totalLoanAmount = member.loans
			.filter((loan) => loan.status === ("DISBURSED" as LoanApprovalStatus))
			.reduce((sum, loan) => sum + Number(loan.amount), 0);

		// Find next payment due
		const nextPayment =
			member.loans
				.filter((loan) => loan.status === ("DISBURSED" as LoanApprovalStatus))
				.flatMap((loan) => loan.loanRepayments)
				.filter((repayment) => repayment.status === "PENDING")
				.sort(
					(a, b) =>
						new Date(a.repaymentDate).getTime() -
						new Date(b.repaymentDate).getTime()
				)[0] || null;

		// Prepare chart data
		const prepareChartData = (transactions: any, type: any) => {
			return transactions
				.filter((transaction: any) => transaction.type === type)
				.map((transaction: any) => ({
					date: transaction.transactionDate,
					amount: Number(transaction.amount),
				}))
				.sort(
					(a: any, b: any) =>
						new Date(a.date).getTime() - new Date(b.date).getTime()
				);
		};

		const savingsHistory = prepareChartData(
			member.transactions,
			TransactionType.SAVINGS
		);
		const loanRepaymentHistory = prepareChartData(
			member.transactions,
			TransactionType.LOAN_REPAYMENT
		);

		// Group transactions by type for pie chart
		const transactionsByType = member.transactions.reduce(
			(acc, transaction) => {
				const type = transaction.type;
				if (!acc[type]) {
					acc[type] = 0;
				}
				acc[type] += Number(transaction.amount);
				return acc;
			},
			{} as Record<string, number>
		);

		// Calculate loan repayment progress
		const loanRepaymentProgress = member.loans
			.filter((loan) => loan.status === ("DISBURSED" as LoanApprovalStatus))
			.map((loan) => {
				const totalRepaid = loan.loanRepayments
					.filter((repayment) => repayment.status === "PAID")
					.reduce((sum, repayment) => sum + Number(repayment.amount), 0);

				const remainingAmount = Number(loan.amount) - totalRepaid;
				const progress = (totalRepaid / Number(loan.amount)) * 100;

				return {
					loanId: loan.id,
					loanAmount: Number(loan.amount),
					totalRepaid,
					remainingAmount,
					progress: isNaN(progress) ? 0 : progress,
				};
			});

		return res.status(200).json(
			{
				member: {
					...member,
					totalSavings,
					totalContributions,
					totalLoanRepayment,
					totalMembershipFee,
					totalWillingDeposit,
					totalRegistrationFee,
					totalCostOfShare,
					activeLoans,
					totalLoanAmount,
					nextPayment,
					lastSavingsAmount: lastSavingsTransaction?.amount || 0,
					lastContributionAmount: lastContributionTransaction?.amount || 0,
					savingsHistory,
					loanRepaymentHistory,
					transactionsByType,
					loanRepaymentProgress,
				},
			},
		
		);
	} catch (error) {
		console.error("Error fetching member details:", error);
		return res.status(500).json(
			{
				error: "Failed to fetch member details",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			
		);
	}
}



);


export default  membersRouter