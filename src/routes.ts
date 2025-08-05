import app from './app.js'
import loansRouter from './controllers/loans.controller.js';
import dashboardRouter from './controllers/dashboard.controller.js';
import membersRouter from './controllers/members.controller.js';
import membershipRouter from './controllers/membership.controller.js';
import authLoginRouter from './controllers/auth/login.auth.js';
import authLogoutRouter from './controllers/auth/logout.auth.js';
import sessionRouter from './controllers/auth/session.auth.js';

app.use('/api/dashboard', dashboardRouter);
app.use('/api/loans', loansRouter);
app.use('/api/members', membersRouter);
app.use('/api/membership', membershipRouter);


// Might add the auth routes

app.use('/api/auth/login', authLoginRouter)
app.use('/api/auth/logout', authLogoutRouter)
app.use('/api/auth/session', sessionRouter)


