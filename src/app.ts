import express from 'express'
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();


app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: true,
    credentials: true
}), );




export default app;