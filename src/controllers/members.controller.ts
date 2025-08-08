import express from 'express'
import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import {
    
	LoanApprovalStatus,
	RepaymentStatus,
	TransactionType,
} from "@prisma/client";
import { getSession } from './auth/auth.js';


const membersRouter = express.Router();

membersRouter.get("/loan-eligibility", async(req, res) => {
	const session = await getSession(req);
	console.log(session?.role!)
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
	}
	catch(err) {
		console.log(err)
		return res.json({error : err})
	}


});



export default  membersRouter