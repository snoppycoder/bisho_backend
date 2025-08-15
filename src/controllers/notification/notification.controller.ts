import {prisma} from "../../config/prisma.js"
import { Notification } from "@prisma/client";
import express from 'express';
import { getSession, getUserFromRequest } from "../auth/auth.js";

interface NotificationPayload {
	userId: number | any;
	title: string;
	message: string;
	type: string;
}
const notificationRouter = express.Router();

export const sendNotification = async (payload: NotificationPayload) => {
	try {
		await prisma.notification.create({
			data: {
				userId: payload.userId,
				title: payload.title,
				message: payload.message,
				type: payload.type as Notification["type"],
			},
		});
	} catch (error) {
		console.error("Error sending notification:", error);
	}
};
notificationRouter.get('/', async (req, res) => {
	try {
		const user = await getSession(req);
		if (!user) {
			return res.status(401).json({error: "Unauthorized"});
		}
		

		const notifications = await prisma.notification.findMany({
			where: {
				userId: user.id!,
			},
			orderBy: {
				createdAt: 'desc',
			},
    });
	   return notifications
	}
	catch(err) {
		console.log(err);
		return res.status(400).json({error: "Error fetching your data"})
	}

});
export default notificationRouter;