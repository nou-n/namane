export enum BaseUrl {
    API = "https://api.i-aurora.co.kr",
    INFO = "https://info.i-aurora.co.kr"
}

export enum TransactionType {
    Transfer = "Transfer",
    Charge = "Charge"
}

export interface DateInput {
    year: number;
    month: number;
    day: number;
}