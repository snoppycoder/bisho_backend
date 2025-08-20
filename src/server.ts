import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import apiRoutes from './routes.js';

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());

// CORS - allow all
app.use(cors({
    origin: '*', 
    credentials: true, // Allow cookies/authorization headers
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.get('/health-check', (req, res) => {
    res.json({ message: 'Server is running' });
});

app.use('/api', apiRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

export default app;
