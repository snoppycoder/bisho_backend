import express from 'express'
import { prisma } from '../config/prisma.js';
import { getSession } from './auth/auth.js';
import { LoanApprovalLog, LoanApprovalStatus, UserRole} from '@prisma/client';
import { sendNotification } from './notification/notification.controller.js';


const loansRouter = express.Router();
const APPROVAL_HIERARCHY: UserRole[] = [UserRole.ACCOUNTANT, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.COMMITTEE];
const APPROVAL_STATUS : LoanApprovalStatus[] = [LoanApprovalStatus.APPROVED_BY_ACCOUNTANT, LoanApprovalStatus.APPROVED_BY_MANAGER, LoanApprovalStatus.APPROVED_BY_SUPERVISOR, LoanApprovalStatus.APPROVED_BY_COMMITTEE, LoanApprovalStatus.DISBURSED];
const MIN_COMMITTEE_APPROVAL = 2;


loansRouter.get('/', async (req, res) => {
	const session = await getSession(req);
	if (!session || session.role === "MEMBER") {
		return res.status(401).json({error : "Unauthorized"})
	}
	const searchTerm = (req.query.search || "").toString();
	const status = req.query.status?.toString();
	const sortBy = req.query.sortBy?.toString() || "createdBy";
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

loansRouter.post('/:id/approve', async (req, res) => {
	const id = req.params.id;
	const session = await getSession(req);
	if (!session) return res.status(401).json({ error: "Unauthorized" });
	const {status, comments} = req.body;
	try {
		
		const loan = await prisma.loan.findUnique({
			where: { id: Number.parseInt(id) },
			include: { member: true },
		});
		
		if (!loan) {
			return res.status(404).json({ error: "Loan not found" });
		}
		if (status === "REJECTED") {
			await sendNotification({
				userId: loan.memberId,
				title: 'Loan Rejected',
				message: `Loan (ID: ${loan.id}) was rejected by ${session.role}.`,
				type: 'LOAN_APPROVAL_UPDATE',
			});
	}
		const loanApprovals = await prisma.loanApprovalLog.findMany({
		where: { loanId: loan.id },
		orderBy: { approvalOrder: 'asc' },
		});

		// we need to make sure the user has the auth to approve
		const currentRoleIndex = APPROVAL_HIERARCHY.indexOf(session.role as UserRole);
		for (let i = 0; i< currentRoleIndex; i++) {
			const role = APPROVAL_HIERARCHY[i];
			if (!loanApprovals.find(log => log.role === role)) {
				return res.status(400).json({error: `${role} must approve the loan before ${session.role}`,});
			}
			
		}
		//let us avoid duplicate approvals if this isn't a committee role
		if (session.role !== UserRole.COMMITTEE){
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
			
			} 
			else {
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
    if (!isFinalApprover && newStatus !== LoanApprovalStatus.DISBURSED) { //and the status is not disbursed
	  const nextRole = APPROVAL_HIERARCHY[currentRoleIndex + 1];
	  if (!nextRole) {
		return res.status(400).json({ error: "Next approval role is undefined." });
	  }
	  const nextUsers = await prisma.user.findMany({
		where: { role: nextRole },
	  });

      for (const user of nextUsers) {
		if (!updatedLoan.status.includes("REJECTED"))
		{
        await sendNotification({
          userId: user.id,
          title:
            currentRoleIndex === APPROVAL_HIERARCHY.length - 2
              ? 'Loan Needs Your Approval Disbursed'
              : 'Loan Needs Your Approval',
          message: `Loan (ID: ${loan.id}) has been approved by ${session.role} and awaits your approval.`,
          type: 'LOAN_APPROVAL_REQUIRED',
        });}
      }
    }

    return res.status(200).json(updatedLoan);
	 

	}
	catch(error) {
		console.error("Error updating loan:", error);
		return res.status(500).json({ error: "Failed to update loan" });
	}
	

})


export default loansRouter;