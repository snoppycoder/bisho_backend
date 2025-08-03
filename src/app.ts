import express from 'express'
import type { Request, Response } from 'express';
import cors from 'cors';
const app = express();





app.use(express.json())
app.use(cors({
    origin: true,
    credentials: true
}), );




export default app;