
export type LoanParams = {
	loanAmount: number;
	interestRate: number;
	loanTerm: number;
	repaymentFrequency: "monthly" | "quarterly" | "annually";
};

export type AmortizationScheduleRow = {
	period: number;
	payment: number;
	principal: number;
	interest: number;
	balance: number;
};