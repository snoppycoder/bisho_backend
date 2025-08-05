import express from 'express'
import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import {
    PrismaClient,
	LoanApprovalStatus,
	RepaymentStatus,
	TransactionType,
} from "@prisma/client";
import { getSession } from './auth/auth.js';
import { generateUniqueNumber } from '../utils/generateUnique.js';


const membershipRouter = express.Router();

membershipRouter.post('/request', async (req, res) => {
	try {
		const { name, email, phone, etNumber, department } = req.body;
		const membershipRequest = await prisma.membershipRequest.create({
			data: {
				name,
				email,
				phone,
				// etNumber: Number.parseInt(etNumber),
				department,
				status: "PENDING",
			},
		});
		return res.status(201).json(membershipRequest);

	}
	catch (error) {
		console.error("Error creating membership request:", error);
		return res.status(500).json(
			{
				error: "Failed to create membership request",
				details: (error as Error).message,
			}
			
		);
	}

});
membershipRouter.get('/requests', async(req, res) => {
	const session = await getSession(req);
	if (!session || session.role === "MEMBER") {
		return res.status(401).json({ error: "Unauthorized" });
	}
	try {
		const requests = await prisma.membershipRequest.findMany({
			orderBy: { createdAt: "desc" },
		});
		return res.json(requests);
	} catch (error) {
		console.error("Error fetching membership requests:", error);
		return res.status(500).json(
			{ error: "Failed to fetch membership requests" }

		);
	}


});
membershipRouter.patch('/requests/:id', async(req, res) => {
	
	const session = await getSession(req);
	if (!session || !["SUPERVISOR", "MANAGER"].includes(session.role)) { // I NEED TO CHECK THIS LATER ON
		return res.status(401).json({ error: "Unauthorized" });
	}
	try {
		const { status } = req.body;
		const id = Number.parseInt(req.params.id);

		const updatedRequest = await prisma.membershipRequest.update({
			where: { id },
			data: { status },
		});
		if (status === "APPROVED") {
			// Get the membership request details
			const membershipRequest = await prisma.membershipRequest.findUnique({
				where: { id },
			});

			if (membershipRequest) {
				// Generate unique etNumber and memberNumber
				const etNumber = await generateUniqueNumber("etNumber");
				const memberNumber = await generateUniqueNumber("memberNumber");

				// Create a new Member record
				const newMember = await prisma.member.create({
					data: {
						name: membershipRequest.name,
						email: membershipRequest.email,
						phone: membershipRequest.phone,
						etNumber,
						memberNumber,
						department: membershipRequest.department,
						// userId: user.id,
					},
				});

				// Create initial MemberBalance record
				await prisma.memberBalance.create({
					data: {
						memberId: newMember.id,
					},
				});

				await fetch("http://94.130.27.32:3001/send-sms", { // mock
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						to: membershipRequest.phone,
						message: `ውድ ${
							membershipRequest.name
						} በኢትዮ ክሬዲት አሶሴሽን በተሳካ ሁኔታ ተመዝገበዋል! የአባልነት ልዩ ቁጥር ${etNumber} : እንዲሁም ጊዚያዊ የማለፊያ ቂጥርዎ 'Test@123tr' ይህ ነው በተጨማሪም በ ${"http://94.130.27.32:3008"} መጎብኘት አገልግሎቱን መጠቀም ይችላሉ::`,
						callback: "https://your-callback-url.com/sms-status",
					}),
				});

				// Return both the updated request and the new member
				return res.json({
					updatedRequest,
					newMember,
				});
			}
		}

		return res.json(updatedRequest);
		
	} catch (error) {
		console.error("Error fetching membership requests:", error);
		return res.status(500).json(
			{ error: "Failed to update membership request", details: (error as Error).message}

		);
	}


});


export default  membershipRouter