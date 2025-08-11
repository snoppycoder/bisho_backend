import express from 'express'
import { prisma } from '../config/prisma.js';
import { getSession } from './auth/auth.js';
import { LoanApprovalLog, LoanApprovalStatus, Prisma, UserRole} from '@prisma/client';
import { sendNotification } from './notification/notification.controller.js';
import fs  from "fs";
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from "path";
import multer from 'multer'
import { calculateLoan } from '../utils/calculate.js';
import mime from 'mime-types';
import { getContentType } from '../utils/getContentType.js';


const loansRouter = express.Router();
const APPROVAL_HIERARCHY: UserRole[] = [UserRole.ACCOUNTANT, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.COMMITTEE];
const APPROVAL_STATUS : LoanApprovalStatus[] = [LoanApprovalStatus.APPROVED_BY_ACCOUNTANT, LoanApprovalStatus.APPROVED_BY_MANAGER, LoanApprovalStatus.APPROVED_BY_SUPERVISOR, LoanApprovalStatus.APPROVED_BY_COMMITTEE, LoanApprovalStatus.DISBURSED];
const MIN_COMMITTEE_APPROVAL = 2;
const upload = multer(); 

loansRouter.get('/', async (req, res) => {
	const session = await getSession(req);
	if (!session || session.role === "MEMBER") {
		return res.status(401).json({error : "Unauthorized"})
	}
	const searchTerm = (req.query.search || "").toString();
	const status = req.query.status?.toString();
	const sortBy = req.query.sortBy?.toString() || "createdAt";
	const sortOrder = req.query.sortOrder?.toString() || "desc";
	const loanId = Number(searchTerm);
	const idFilter = !isNaN(loanId) ? { id: { equals: loanId } } : undefined;
	try {
		const loans = await prisma.loan.findMany({
			where: {
				OR: [
					{ member: { name: { contains: searchTerm, mode: "insensitive" } } },
					idFilter
				].filter(Boolean) as any[],
				status: status as any,
			},
			include: {
				member: {
					select: {
						name: true,
					},
				},
			},
			orderBy: {
				[sortBy]: sortOrder,
			},
		});
		return res.status(200).json(loans);

	}
	catch(error) {
		console.log(error);
		return res.status(500).json({error : 'Internal Server Error'})
	}

});

// updatestatus check
loansRouter.get('/agreement-template', async(req, res) => {
	
	const session = await getSession(req);
	if (!session || session.role !== "MEMBER") {
		return res.status(401).json({ error: "Unauthorized" });
	}
	try {
		const filePath = path.join(
			process.cwd(),
			"public",
			"loan_agreement_template.pdf"
		);
		const fileBuffer = fs.readFileSync(filePath);

		res.set("Content-Type", "application/pdf");
		res.set(
			"Content-Disposition",
			"attachment; filename=loan_agreement_template.pdf"
		);
		res.send(fileBuffer);
	}
		catch(error) {
			console.error("Error serving loan agreement template:", error);
		return res.status(500).json(
			{ error: "Failed to serve loan agreement template" },
			
		);
		}
});
 loansRouter.get('/approval-history', async(req, res) => {
	const session = await getSession(req);
	if (!session || session.role !== "MEMBER") {
		return res.status(401).json({ error: "Unauthorized" });
	}
	const search =( req.query.search || "").toString();
	const status = req.query.status || "ALL";
	const fromDate = req.query.fromDate;
	const toDate = req.query.toDate;
	const page = parseInt((req.query.page ?? "1").toString(), 10);
	const pageSize = parseInt((req.query.pageSize ?? "10").toString(), 10);
	try {
		const where: Prisma.LoanApprovalLogWhereInput = {
			OR: [
				...(Number.isFinite(Number.parseInt(search)) ? [{ loan: { id: Number.parseInt(search) } }] : []),
				{
					loan: { member: { name: { contains: search, mode: "insensitive" } } },
				},
				{ user: { name: { contains: search, mode: "insensitive" } } },
			],
			...(status !== "ALL" && {
				status: status as Prisma.EnumLoanApprovalStatusFilter,
			}),
			...(typeof fromDate === "string" &&
				typeof toDate === "string" && {
					approvalDate: {
						gte: new Date(fromDate),
						lte: new Date(toDate),
					},
				}),
		};
		const [approvalLogs, totalCount] = await Promise.all([
			prisma.loanApprovalLog.findMany({
				where,
				include: {
					loan: {
						select: {
							id: true,
							amount: true,
							status: true,
							member: {
								select: {
									name: true,
									etNumber: true,
								},
							},
						},
					},
					user: {
						select: {
							name: true,
						},
					},
				},
				orderBy: [{ loanId: "asc" }, { approvalOrder: "asc" }],
				skip: (page - 1) * pageSize,
				take: pageSize,
			}),
			prisma.loanApprovalLog.count({ where }),
		]);
		const formattedLogs = approvalLogs.map((log) => ({
			id: log.id,
			loanId: log.loanId,
			loanAmount: log.loan.amount,
			loanStatus: log.loan.status,
			memberName: log.loan.member.name,
			memberEtNumber: log.loan.member.etNumber,
			approvedBy: log.user.name,
			approverRole: log.role,
			status: log.status,
			approvalOrder: log.approvalOrder,
			comments: log.comments,
			approvalDate: log.approvalDate,
		}));
		return res.json({
			logs: formattedLogs,
			totalCount,
			totalPages: Math.ceil(totalCount / pageSize),
		});



	}
	catch(error){
	console.error("Error fetching approval history:", error);
			return res.status(500).json(
				{ error: "Failed to fetch approval history" })
		}


 });
  loansRouter.get('/pending', async(req, res) => {
	const session = await getSession(req);
	if (!session || session.role !== "MEMBER") {
		return res.status(401).json({ error: "Unauthorized" });
	}
	const userRole = session.role as UserRole;
	let reqApprovalOrder : number = -1;
	for (var i = 0; i < APPROVAL_HIERARCHY.length; i++) {
		if (userRole === APPROVAL_HIERARCHY[i]) {
			reqApprovalOrder = i;
			break;
		}
	}
	const pendingLoans = await prisma.loan.findMany({
			where: {
				status: "PENDING",
				approvalLogs: {
					some: {
						approvalOrder: reqApprovalOrder,
						status: "APPROVED",
					},
				},
			},
			include: {
				member: true,
				approvalLogs: {
					orderBy: { approvalOrder: "desc" },
					take: 1,
				},
			},
		});

		return res.json(pendingLoans);

  });


loansRouter.post('/apply', upload.single('agreement'), async(req, res)=> {
	const session = await getSession(req);
	if (!session) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	try{
	const {amount, interestRate, tenureMonths, purpose, coSigner1, coSigner2,} = req.body;
	const agreement = req.file;
	 if (!amount || !interestRate || !tenureMonths || !purpose || !agreement) {
      return res.status(400).json({ error: "Missing required fields" });
    }
	const loanAmount = parseFloat(amount);
    const rate = parseFloat(interestRate);
    const tenure = parseInt(tenureMonths, 10);
	if (rate !== 9.5) {
      return res.status(400).json({ error: "Interest rate must be 9.5%" });
    }
    if (tenure !== 120) {
      return res.status(400).json({ error: "Loan tenure must be 120 months (10 years)" });
    }
	if (!session.id) return;
	const member = await prisma.member.findUnique({
			where: { id: session.id },
			include: {
				balance: true,
				loans: {
					where: {
						status: {
							in: ['PENDING', 'APPROVED_BY_COMMITTEE', 'APPROVED_BY_MANAGER', 'APPROVED_BY_SUPERVISOR', 'APPROVED_BY_ACCOUNTANT', 'DISBURSED'],
						},
					},
				},
			},
		});
		if (!member) {
			return res.status(404).json({ error: "Member not found" });
		}
		const monthlySalary = 15000; // This should come from member data
		const maxLoanBasedOnSalary = monthlySalary * 30;
		const hasActiveLoan = member.loans.length > 0;
		const requiredContributionRate = hasActiveLoan ? 0.35 : 0.3;
		const totalContribution = Number(member.balance?.totalContributions || 0);
		const maxLoanBasedOnContribution = totalContribution / requiredContributionRate;
		const maxLoanAmount = Math.min(
			maxLoanBasedOnSalary,
			maxLoanBasedOnContribution
		);
		const requiredContribution = loanAmount * requiredContributionRate;

		// Validate loan amount against limits
		if (loanAmount > maxLoanAmount) {
			return res.status(400).json(
				{
					error: `Loan amount exceeds maximum limit of ${maxLoanAmount.toLocaleString()} ETB`,
				}
			);
		}
		if (totalContribution < requiredContribution) {
			return res.status(400).json(
				{
					error: `Insufficient contribution. Required: ${requiredContribution.toLocaleString()} ETB, Available: ${totalContribution.toLocaleString()} ETB`,
				}
			);
		}
		const fileExtension = path.extname(agreement.originalname);
		const fileName = `loan_agreement_${Date.now()}_${
			member.id
		}${fileExtension}`;
		const uploadDir = path.join(process.cwd(), "public", "loan_agreements");
		const filePath = path.join(uploadDir, fileName);
		try {
			await mkdir(uploadDir, {recursive: true});
		}
		catch(err) {
			if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
				throw err;
			}
		}
		await writeFile(filePath, agreement.buffer);
		const documentUrl = `/loan_agreements/${fileName}`;
		const loan = await prisma.loan.create({
			data: {
				memberId: member.id,
				amount: loanAmount,
				remainingAmount: loanAmount,
				interestRate: rate,
				tenureMonths: tenure,
				status: "PENDING",
				loanDocuments: {
					create: {
						documentType: "AGREEMENT",
						documentContent: "",
						uploadedByUserId: Number(process.env.ADMIN_ID || 1),
						fileName: fileName,
						mimeType: agreement.mimetype,
						documentUrl: documentUrl,
					} as any,
				},
				approvalLogs: {
					create: {
						approvedByUserId: Number(process.env.ADMIN_ID || 1),
						role: "MEMBER",
						status: "PENDING",
						approvalOrder: 0,
						comments: `Loan application submitted. Purpose: ${purpose}. Co-signers: ${
							coSigner1 ? `ID:${coSigner1}` : "None"
						}, ${coSigner2 ? `ID:${coSigner2}` : "None"}`,
					} as any,
				},
			},
		});
		await prisma.notification.create({
			data: {
				userId: Number(process.env.ADMIN_ID || 1),
				title: "New Loan Application",
				message: `New loan application for ${loanAmount.toLocaleString()} ETB submitted by ${
					member.name
				}`,
				type: "LOAN_APPLICATION_SUBMITTED",
			} as any,
		});
		return res.json({
			success: true,
			loanId: loan.id,
			documentUrl: documentUrl,
			message: "Loan application submitted successfully",
		});}
		catch(error){
			console.error("Error processing loan application:", error);
		return res.status(500).json(
			{ error: "Failed to process loan application" },
			
		);
		}




	
});
loansRouter.get('/disbursed', async(req, res) => {
	
	const session = await getSession(req);
	if (!session || session.role === "MEMBER") {
		return res.status(401).json({ error: "Unauthorized" });
	}

	try {
		const disbursedLoans = await prisma.loan.findMany({
			where: {
				status: "DISBURSED",
			},
			include: {
				member: {
					select: {
						name: true,
						etNumber: true,
					},
				},
				loanRepayments: {
					select: {
						id: true,
						amount: true,
						repaymentDate: true,
						status: true,
					},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		return res.json(disbursedLoans);
	} catch (error) {
		console.error("Error fetching disbursed loans:", error);
		return res.status(500).json(
			{ error: "Failed to fetch disbursed loans" },
			
		);
	}

})
loansRouter.post('/calculate', async (req, res) => {
	try {
		const body = req.body;
		const result = calculateLoan(body);
		return res.status(201).json(result);

	}
	catch (error) {
		console.error("Error calculating loan:", error);
		return res.status(500).json(
			{ error: "Failed to calculate loan" }
			
		);
	}
});
loansRouter.get('/documents', async(req, res) => {
	const session = await getSession(req);
	if (
		!session ||
		![
			"ACCOUNTANT",
			"COMMITTEE",
			"MANAGER",
			"SUPERVISOR",
			"MEMBER",
		].includes(session.role) 
	){
		return res.status(401).json({ error: "Unauthorized" });
	}
	try {
		const documents = await prisma.loanDocument.findMany({
			select: {
				id: true,
				loanId: true,
				documentType: true,
				fileName: true,
				uploadDate: true,
				documentUrl: true,
			},
			orderBy: { uploadDate: "desc" },
		});
		return res.json(documents);
	} catch(error){
		console.error("Error fetching document:", error);
		return res.status(500).json(
			{ error: "Internal server error" }
			
		);
	}
	
});
loansRouter.post('/documents', upload.single("file"), async (req, res) => {
	const session = await getSession(req);
	if (
		!session ||
		![
			"ACCOUNTANT",
			"COMMITTEE",
			"MANAGER",
			"SUPERVISOR",
			"MEMBER",
		].includes(session.role) 
	){
		return res.status(401).json({ error: "Unauthorized" });
	}
	try {
		 
		const file = req.file;
		const documentType = req.body.documentType;
  		const loanId = Number(req.body.loanId);

		if (!file || !documentType || !loanId) {
			return res.status(400).json(
				{ error: "Missing required fields" },
				
			);
		}

		
		const fileContent = file.buffer;

		// Generate a unique document URL
		const documentUrl = `/api/loans/documents/${Date.now()}-${file.originalname}`;

		const document = await prisma.loanDocument.create({
			data: {
				loanId,
				documentType,
				fileName: file.originalname,
				mimeType: file.mimetype,
				documentContent: fileContent,
				uploadedByUserId: session.id,
				documentUrl, // Add the documentUrl field
			} as any,
		});

		return res.json({
			success: true,
			documentId: document.id,
			documentUrl: document.documentUrl,
		});
	} catch(error){
		console.error("Error fetching document:", error);
		return res.status(500).json(
			{ error: "Internal server error" }
			
		);
	}
});
loansRouter.get('/:id', async (req, res) => {
	
		const session = await getSession(req);
	if (
		!session || !session.id
	)
	{
		return res.status(401).json({ error: "Unauthorized" });
	}
	const loanId = Number.parseInt( req.params.id);
	if (!loanId) return res.status(401).json({ error: "Unauthorized" });

	
	try {
		const loan = await prisma.loan.findUnique({
			where: { id: loanId },
			include: {
				member: {
					select: {
						name: true,
						etNumber: true,
						user: {
							select: {
								email: true,
								phone: true,
							},
						},
					},
				},
				approvalLogs: {
					include: {
						user: {
							select: {
								name: true,
							},
						},
					},
					orderBy: {
						approvalOrder: "asc",
					},
				},
				loanRepayments: {
					orderBy: {
						repaymentDate: "asc",
					},
				},
				loanDocuments: {
					select: {
						id: true,
						documentType: true,
						documentUrl: true,
						fileName: true,
						uploadDate: true,
					},
				},
			},
		});

		if (!loan) {
			return res.status(404).json({ error: "Loan not found" });
		}

		// Restructure the data to match the frontend expectations
		const restructuredLoan = {
			...loan,
			member: {
				...loan.member,
				email: loan.member.user?.email,
				phone: loan.member.user?.phone,
			},
		};

		return res.json(restructuredLoan);

	}

	
	catch(error){
		console.error("Error fetching document:", error);
		return res.status(500).json(
			{ error: "Internal server error" }
			
		);
	}

});
loansRouter.get('/documents/:id', async(req, res) => {
	
	const session = await getSession(req);
	if (
		!session ||
		![
			"ACCOUNTANT",
			"COMMITTEE",
			"MANAGER",
			"SUPERVISOR",
			"MEMBER",
		].includes(session.role) 
	){
		return res.status(401).json({ error: "Unauthorized" });
	}
	try {
		const documentId = req.params.id; 
		const document = await prisma.loanDocument.findUnique({
			where: { id: Number.parseInt(documentId) },
		});
		if (!document) {
			return res.status(404).json({error : "Document not found!"})
		}
		if (session.role === "MEMBER") {
			const loan = await prisma.loan.findUnique({
				where: { id: document.loanId },
				select: { memberId: true },
		});
		if (!loan || loan.memberId !== session.etNumber) {
				return res.status(401).json({ error: "Unauthorized" });
				
			}
		}
		const response = res.type(document.mimeType)
							.set(
								"Content-Disposition",
								`inline; filename="${document.fileName}`
							)
		return response;
 
	}
	catch(error){
		console.error("Error fetching document:", error);
		return res.status(500).json(
			{ error: "Internal server error" }
			
		);
	}

});
loansRouter.get('/documents/view', async(req, res) => {
	const session = await getSession(req);
	if (!session || !session.id) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	const url = req.query.url;
    if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "Missing or invalid URL parameter" });
    }
	try {
		let buffer : Buffer;
		let contentType: string;

		if (url.startsWith("http://") || url.startsWith("https://")) {
			const response = await fetch(url);
			const arrayBuffer = await response.arrayBuffer();
			buffer = Buffer.from(arrayBuffer);
			contentType = response.headers.get("Content-Type") || "application/octet-stream";
		}
		else {
			const filePath = path.join(process.cwd(), "public", url);
			buffer = await readFile(filePath);
			contentType = getContentType(filePath);

		}
		res.setHeader("Content-Type", contentType);
		res.setHeader("Content-Disposition", "inline");
		res.send(buffer);

	}
	catch(error) {
		console.error("Error fetching document:", error);
		return  res.status(500).json("Failed to fetch document");

	}



});

loansRouter.post('/approve/:id', async (req, res) => {

  const id = req.params.id;
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { status, comments } = req.body;
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: Number.parseInt(id) },
      include: { member: true },
    });
    if (!loan) return res.status(404).json({ error: "Loan not found" });

    if (status === "REJECTED") {
      await sendNotification({
        userId: loan.memberId,
        title: 'Loan Rejected',
        message: `Loan (ID: ${loan.id}) was rejected`,
        type: 'LOAN_APPROVAL_UPDATE',
      });
    }

    const loanApprovals = await prisma.loanApprovalLog.findMany({
      where: { loanId: loan.id },
      orderBy: { approvalOrder: 'asc' },
    });

    const currentRoleIndex = APPROVAL_HIERARCHY.indexOf(session.role as UserRole);
    for (let i = 0; i < currentRoleIndex; i++) {
      const role = APPROVAL_HIERARCHY[i];
      if (!loanApprovals.find(log => log.role === role)) {
        return res.status(400).json({ error: `${role} must approve the loan before ${session.role}` });
      }
    }

    if (session.role !== UserRole.COMMITTEE) {
      if (loanApprovals.some(log => log.role === session.role)) {
        return res.status(400).json({ error: `${session.role} has already approved this loan.` });
      }
    }

    let committeeApprovedCount = 0;
    let committeeRejectedCount = 0;

    if (session.role === UserRole.COMMITTEE) {
      committeeApprovedCount = loanApprovals.filter(
        log => log.role === UserRole.COMMITTEE && log.status === LoanApprovalStatus.APPROVED_BY_COMMITTEE
      ).length;

      committeeRejectedCount = loanApprovals.filter(
        log => log.role === UserRole.COMMITTEE && log.status === LoanApprovalStatus.REJECTED_BY_COMMITTEE
      ).length;
    }

    let newStatus = APPROVAL_STATUS[currentRoleIndex];
    let logStatus = newStatus;

    if (session.role === UserRole.COMMITTEE) {
      if (status === "REJECTED") {
        logStatus = LoanApprovalStatus.REJECTED_BY_COMMITTEE;
        newStatus = LoanApprovalStatus.REJECTED;
      } else {
        logStatus = LoanApprovalStatus.APPROVED_BY_COMMITTEE;
        committeeApprovedCount += 1;

        if (committeeApprovedCount >= MIN_COMMITTEE_APPROVAL) {
          newStatus = LoanApprovalStatus.DISBURSED;
        }
      }
    }

    if (logStatus === undefined) {
      return res.status(400).json({ error: "Invalid approval status." });
    }

    const updatedLoan = await prisma.loan.update({
      where: { id: Number.parseInt(id) },
      data: {
        status: logStatus,
        approvalLogs: {
          create: {
            approvedByUserId: session.id,
            role: session.role as LoanApprovalLog["role"],
            newStatus,
            approvalOrder: currentRoleIndex + 1,
            comments,
          } as any,
        },
      },
    });

    const isFinalApprover = currentRoleIndex === APPROVAL_HIERARCHY.length - 1;
    
    if (!isFinalApprover && newStatus !== LoanApprovalStatus.DISBURSED) {
      const nextRole = APPROVAL_HIERARCHY[currentRoleIndex + 1];
      if (!nextRole) {
        return res.status(400).json({ error: "Next approval role is undefined." });
      }
      
      const nextUsers = await prisma.user.findMany({
        where: { role: nextRole },
      });

      for (const user of nextUsers) {
        await sendNotification({
          userId: user.id,
          title: "Loan Approval Required",
          message: `Loan ID ${loan.id} requires your approval.`,
          type: "LOAN_APPROVAL_PENDING",
        });
      }
    }

    return res.json({
      success: true,
      message: `Loan ${status === "REJECTED" ? "rejected" : "approved"} successfully.`,
      loan: updatedLoan,
    });

  } catch (error) {
    console.error("Error approving loan:", error);
    return res.status(500).json({ error: "Failed to process loan approval." });
  }
});

loansRouter.patch('/status/:id', async(req, res) => {
	const id = req.params.id;
	const session = await getSession(req);
	if (!session || session.role === "MEMBER") {
		return res.status(401).json({ error: "Unauthorized" });
	}
	const loanId = Number.parseInt(id);
	const { status } = await req.body;
	try {
		const updatedLoan = await prisma.loan.update({
			where: { id: loanId },
			data: { status },
		});

		return res.json(updatedLoan);
	} catch (error) {
		console.error("Error updating loan status:", error);
		return res.status(500).json(
			{ error: "Failed to update loan status" },
			);
	}

});



export default loansRouter;