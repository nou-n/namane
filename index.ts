import tink from "tink-crypto";
import axios from "axios";
import type { AxiosResponse } from "axios";
import { type DateInput, BaseUrl, TransactionType } from "./types";

tink.aead.register();

export default class Namane {
    private authorization: string = "";
    private cookie: string = "";
    private userAgent: string = "okhttp/4.9.2";

    private userNo: string = "";

    constructor() {
        this.cookie = `KHANUSER=${this.generateKhanUser()}`;
    }

    async fetchAccount(data: { encryptedCardNo: string, amount: number, bankCode: string, accountNo: string }): Promise<{
        success: boolean,
        message: string,
        data?: {
            name: string,
            amount: number,
            accountNo: string
        }
    }> {
        if(!this.authorization || !this.userNo)
            throw new Error("Unauthorized.");

        if(data.amount < 1000)
            throw new Error("Minimum amount is 1000.");

        const { data: response } = await this.sendPostRequest(BaseUrl.API, "fcsefn08u0", {
            usrNo: this.userNo,
            bkcd: `1${data.bankCode}`, // 금융결제원 공식 코드 기준
            acno: data.accountNo.replace(/\D/g, ""),
            trAmt: data.amount.toString(),
            iapCrdNoEcyVl: data.encryptedCardNo
        });

        if (response.rspHdr.rc != "0")
            return {
                success: false,
                message: response.rspHdr.splmMsg
            };

        return {
            success: true,
            message: response.rspHdr.splmMsg,
            data: {
                name: response.rspBody.dpwnNm,
                amount: parseInt(response.rspBody.trAmt),
                accountNo: response.rspBody.acno
            }
        };
    }

    async fetchTransactions(data: { encryptedCardNo: string, startDate: DateInput, endDate: DateInput }): Promise<{ 
        success: Boolean,
        message: string,
        data?: {
            transactionMemo: string,
            transactionAmount: number,
            transactionDate: DateInput,
            transactionType: TransactionType,
            status: string
        }[]
    }> {
        if(!this.authorization || !this.userNo)
            throw new Error("Unauthorized.");
        
        const start = new Date(data.startDate.year, data.startDate.month - 1, data.startDate.day);
        const end = new Date(data.endDate.year, data.endDate.month - 1, data.endDate.day);

        if(start.getTime() >= end.getTime())
            throw new Error("startDate must be less than endDate.");

        const days = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        if(days > 92)
            throw new Error("Maximum period is 92 days.");

        const { data: response } = await this.sendPostRequest(BaseUrl.API, "fcsdps01ic", {
            iapCrdNoEcyVl: data.encryptedCardNo,
            inqStDt: this.formatDate(start),
            inqEndDt: this.formatDate(end)
        });

        if (response.rspHdr.rc != "0")
            return {
                success: false,
                message: response.rspHdr.splmMsg
            };

        const transactions: {
            transactionMemo: string,
            transactionAmount: number,
            transactionDate: DateInput,
            transactionType: TransactionType,
            status: string
        }[] = [];
        for(let transaction of response.rspBody.sub01)
            transactions.push({
                transactionMemo: transaction.trPrtnCts,
                transactionAmount: parseInt(transaction.trAmt),
                transactionDate: this.parseDate(transaction.trDt),
                transactionType: transaction.trSmrCts.startsWith("송금") ? TransactionType.Transfer : TransactionType.Charge,
                status: transaction.aprvCnclTrDscdNm
            });

        return {
            success: true,
            message: response.rspHdr.splmMsg,
            data: transactions
        };
    }

    async fetchCards(): Promise<{ 
        success: Boolean,
        message: string,
        data?: {
            encryptedCardNo: string,
            maskedCardNo: string,
            cardName: string,
            cardImageUrl: string
        }[]
    }> {
        if(!this.authorization || !this.userNo)
            throw new Error("Unauthorized.");

        const { data: response } = await this.sendPostRequest(BaseUrl.API, "fcsdp901i1", {
            usrNo: this.userNo
        });

        if (response.rspHdr.rc != "0")
            return {
                success: false,
                message: response.rspHdr.splmMsg
            };

        const cards: {
            encryptedCardNo: string,
            maskedCardNo: string,
            cardName: string,
            cardImageUrl: string
        }[] = [];
        for(let card of response.rspBody.sub01)
            cards.push({
                encryptedCardNo: card.iapCrdNoEcyVl,
                maskedCardNo: card.iapMskCdno,
                cardName: card.iapCrdNm,
                cardImageUrl: card.iapCrdImgUrl
            });

        return {
            success: true,
            message: response.rspHdr.splmMsg,
            data: cards
        };
    }

    async login(user: { id: string, password: string }): Promise<{ 
        success: Boolean,
        message: string,
        data?: {
            userNo: string,
            userName: string
        }
    }> {
        if(!user.id || !user.password)
            throw new Error("ID and password are required.");

        if(!/^\d{6}$/.test(user.password))
            throw new Error("Password must be a 6-digit number.");

        const keyset = await this.generateKeyset();
        const keysetHandle = keyset.keysetHandle;
        const primitive = await keysetHandle.getPrimitive(tink.aead.Aead);

        const encryptedPassword = Buffer.from(await primitive.encrypt(
            this.stringToUint8Array((parseInt(user.password) * 6).toString()),
            new Uint8Array()
        )).toString("base64");

        const { data: response } = await this.sendPostRequest(BaseUrl.INFO, "fcuath01u0", {
            crtsVl: keyset.base64,
            usrPwdVl: encryptedPassword,
            usrSvcId: user.id,
            pwdCalVl: "6",
            mblPgmDscd: "A01",
            mblPgmVrsNo: 4194606, // com.iaurora.cardforme.BuildConfig.VERSION_CODE
            mblPgmVrsNm: "4.0.3" // com.iaurora.cardforme.BuildConfig.VERSION_NAME
        }, true);

        if (response.rspHdr.rc != "0")
            return {
                success: false,
                message: response.rspHdr.splmMsg
            };

        const token: string = response.rspBody.intgCerTkn;
        this.authorization = `IA ${token}`;

        this.userNo = response.rspBody.usrNo;

        return {
            success: true,
            message: response.rspHdr.splmMsg,
            data: {
                userNo: this.userNo,
                userName: response.rspBody.usrAls
            }
        };
    }

    private async sendPostRequest(baseUrl: BaseUrl, targetService: string, requestBody: any, nocerSvc: Boolean = false): Promise<AxiosResponse> {
        return await axios.post(`${baseUrl}/service/${targetService}`, {
            rqsHdr: {
                uiCd: "0000000000",
                nocerSvcYn: nocerSvc ? "Y" : "N",
                flRqsDscd: "",
                rqsTpcd: "1",
                svcCd: targetService,
                snprSvrSgnt: "",
                rqsTrmDscd: "M"
            },
            rqsBody: requestBody
        }, {
            headers: {
                Authorization: this.authorization,
                "User-Agent": this.userAgent,
                Cookie: this.cookie
            }
        });
    }

    private parseDate(dateString: string): DateInput {
        const regex = /^\d{8}$/;
        if (!regex.test(dateString))
            throw new Error("Date must be in YYYYMMDD format.");
    
        const year = parseInt(dateString.substring(0, 4), 10);
        const month = parseInt(dateString.substring(4, 6), 10);
        const day = parseInt(dateString.substring(6, 8), 10);
    
        return { year, month, day };
    }

    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const day = (date.getDate()).toString().padStart(2, "0");
        return `${year}${month}${day}`;
    }
    
    private async generateKeyset(): Promise<{
        keysetHandle: tink.KeysetHandle,
        base64: string
    }> {
        const keysetHandle = await tink.generateNewKeysetHandle(tink.aead.aes128GcmKeyTemplate())
        const keyset = keysetHandle.getKeyset();

        const keysetJson = {
            primaryKeyId: keyset.getPrimaryKeyId(),
            key: [
                {
                    keyData: {
                        typeUrl: keyset.getKeyList()[0].getKeyData().getTypeUrl(),
                        value: Buffer.from(keyset.getKeyList()[0].getKeyData().getValue_asU8()).toString("base64"),
                        keyMaterialType: "SYMMETRIC"
                    },
                    status: "ENABLED",
                    keyId: keyset.getKeyList()[0].getKeyId(),
                    outputPrefixType: "TINK"
                }
            ]
        };
        return {
            keysetHandle,
            base64: Buffer.from(JSON.stringify(keysetJson), "utf-8").toString("base64")
        };
    }

    private generateKhanUser(): string {
        const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
        let khanUser = "";
        for (let i = 0; i < 14; i++)
            khanUser += characters[Math.floor(Math.random() * characters.length)];
        return khanUser;
    }

    private stringToUint8Array(text: string): Uint8Array {
        return new TextEncoder().encode(text);
    }
}
