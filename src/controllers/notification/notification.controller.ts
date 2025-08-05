import {prisma} from "../../config/prisma.js"
import { Notification } from "@prisma/client";

interface NotificationPayload {
	userId: number | any;
	title: string;
	message: string;
	type: string;
}

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