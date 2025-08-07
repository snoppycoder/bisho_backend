import express from 'express'
import { removeAuthCookie } from "./auth.js"


const authLogoutRouter = express.Router();

authLogoutRouter.post('/', async (req, res) => {
    removeAuthCookie(res);
    const response = res.json({success : true});
    return response;
})

export default authLogoutRouter;