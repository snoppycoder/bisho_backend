import { Router } from 'express';
import loansRouter from './controllers/loans.controller.js';
import dashboardRouter from './controllers/dashboard.controller.js';
import membersRouter from './controllers/members.controller.js';
import membershipRouter from './controllers/membership.controller.js';
import authLoginRouter from './controllers/auth/login.auth.js';
import authLogoutRouter from './controllers/auth/logout.auth.js';
import sessionRouter from './controllers/auth/session.auth.js';
import notificationRouter from './controllers/notification/notification.controller.js';
import adminSignupRouter from './controllers/auth/admin/signup.auth.js';
// import reportRouter from './controllers/report.controller.js';
// import salaryRouter from './controllers/importSalary.controller.js';
const router = Router();

router.use('/dashboard', dashboardRouter);
router.use('/loans', loansRouter);
router.use('/members', membersRouter);
router.use('/membership', membershipRouter);
router.use('/notifications', notificationRouter);
// router.use('/report', reportRouter);
// router.use('/importSalary', salaryRouter);


// Might add the auth routes

router.use('/auth/login', authLoginRouter)
router.use('/auth/logout', authLogoutRouter)
router.use('/auth/session', sessionRouter);
router.use("/auth/register", adminSignupRouter);

export default router;
