import express from 'express'
import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import {
    LoanApprovalStatus,
	RepaymentStatus,
	TransactionType,
} from "@prisma/client";




const willingDepositRouter = express.Router();


export default  willingDepositRouter