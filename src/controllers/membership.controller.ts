import express from 'express'
import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import {
    PrismaClient,
	LoanApprovalStatus,
	RepaymentStatus,
	TransactionType,
} from "@prisma/client";


const membershipRouter = express.Router();


export default  membershipRouter