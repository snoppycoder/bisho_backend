import app from './app'
import loansRouter from './controllers/loans.controller';
import dashboardRouter from './controllers/dashboard.controller';
import membersRouter from './controllers/members.controller';
import membershipRouter from './controllers/membership.controller';

app.use('/api/dashboard', dashboardRouter);
app.use('/api/loans', loansRouter);
app.use('/api/members', membersRouter);
app.use('/api/membership', membershipRouter);


// Might add the auth routes

