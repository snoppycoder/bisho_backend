import express from 'express'
import type { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import * as bcrypt from 'bcrypt';
import { signJWT, setAuthCookie } from "./auth"


const authLoginRouter = express.Router();

authLoginRouter.post('/', async (req, res) => {
    try {
        const {identifier, password} = req.body;

        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
            const user = await prisma.user.findUnique({
				where: { email: identifier },
			});
            if (!user) {
				return res.status(401).json(
					{ error: "Invalid credentials" }
					
				);}

        
        const passwordMatch = await bcrypt.compare(password, user.password);
			if (!passwordMatch) {
				return res.status(401).json(
					{ error: "Invalid credentials" },
					
				);
			}
            const payload = {
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
			};
           const token = await signJWT(payload);

           const response = res.json({
				user: {
					id: user.id,
					name: user.name,
					email: user.email,
					role: user.role,
				},
				redirectUrl: "/dashboard",
			});

            setAuthCookie(token, response)
        }
        
    }
    catch(error) {
        console.log(error);
        return res.status(500).json(
           { error: "Internal server error"}
        )
    }
})


export default authLoginRouter;