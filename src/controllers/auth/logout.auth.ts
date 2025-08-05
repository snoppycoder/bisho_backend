import express from 'express'
import { removeAuthCookie } from "./auth.js"


const authLogoutRouter = express.Router();

authLogoutRouter.post('/', async (req, res) => {
    const response = res.json({success : true});
    removeAuthCookie(res);
    return response;
})

export default authLogoutRouter;