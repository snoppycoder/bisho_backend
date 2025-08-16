
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
export interface MemberData {
	"Location Category": string;
	"Location": string;
	"Employee Number": number;
	"ET Number": number;
	"Assignment Number": number;
	"Name": string;
	"Division": string;
	"Department"?: string;
	"Section": string;
	"Group": string;
	"Assignment Status": string;
	"Effective Date": number;
	"Credit Association Savings": number;
	"Credit Association Membership Fee": number;
	"Credit Association Registration Fee": number;
	"Credit Association Cost of Share": number;
	"Credit Association Loan Repayment": number;
	"Credit Association Purchases": number;
	"Credit Association Willing Deposit": number;
	"Total": number;
}

export interface Account {
	id: number;
	code: string;
	name: string;
	account_type: string;
}

// interface TransactionDetails {
// 	type: string;
// 	amount?: number;
// 	amount?: number;
// 	interest?: number;
// 	date?: string;
// 	reference?: string;
// 	journalId?: number;
// }

export interface JournalLineItem {
	account_id: number;
	name: string;
	debit: number;
	credit: number;
}

export interface JournalEntry {
	move_type: string;
	journal_id: number;
	date: string;
	ref: string;
	line_ids: [number, number, JournalLineItem][];
}
