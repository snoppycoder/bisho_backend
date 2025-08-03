import express from 'express';
import {Request, Response} from 'express'

export default function identifyUser(req:Request, res: Response) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")? authHeader.split(" ")[1] : req.cookies
}