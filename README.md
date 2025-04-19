# *namane*
나마네카드 API

## Installation

To install dependencies:

```bash
bun install
```

## Usage

<details><summary><h3>클라이언트 생성</h3></summary>

```typescript
import Namane from ".";

const client = new Namane();
```
</details>

<details><summary><h3>로그인</h3></summary>

```typescript
await client.login({
    id: "아이디",
    password: "6자리 비밀번호 (e.g., 123456)"
});
```

#### 반환
- 성공 시
   ```typescript
   {
       success: true,
       message: "정상 처리되었습니다.",
       data: {
           userNo: "2024101...",
           userName: "UserName"
       }
   }
   ```
- 실패 시
   ```typescript
   {
       success: false,
       message: "실패 사유"
   }
   ```
</details>

<details><summary><h3>카드 조회</h3></summary>

보유 중인 카드를 가져옵니다.

```typescript
await client.fetchCards();
```

#### 반환
- 성공 시
   ```typescript
   {
       success: true,
       message: "정상 처리되었습니다.",
       data: [
           {
               encryptedCardNo: "3OXlAnvi...",
               maskedCardNo: "1234********5678",
               cardName: "나마네선불",
               cardImageUrl: "https://img.i-aurora.co.kr/file/..."
           }
       ]
   }
   ```
- 실패 시
   ```typescript
   {
       success: false,
       message: "실패 사유"
   }
   ```
</details>

<details><summary><h3>페이 잔액 이용내역 조회</h3></summary>

페이 잔액 이용내역을 가져옵니다. 최대 조회 기간은 92일입니다.

```typescript
await client.fetchTransactions({
    encryptedCardNo: "3OXlAnvi...",
    startDate: {
        year: 2024,
        month: 12,
        day: 1
    },
    endDate: {
        year: 2025,
        month: 2,
        day: 1
    }
});
```

#### 반환
- 성공 시
   ```typescript
   {
       success: true,
       message: "정상 처리되었습니다.",
       data: [
           {
               transactionMemo: "",
               transactionAmount: 10000,
               transactionDate: {
                   year: 2025,
                   month: 1,
                   day: 1
               },
               transactionType: "Charge 또는 Transfer",
               status: "승인"
           }
       ]
   }
   ```
- 실패 시
   ```typescript
   {
       success: false,
       message: "실패 사유"
   }
   ```
</details>

<details><summary><h3>계좌 예금주 조회</h3></summary>

계좌 번호의 예금주를 조회합니다.

```typescript
await client.fetchAccount({
    bankCode: "금융결제원 공식 코드 (e.g., 089)",
    accountNo: "1234...",
    encryptedCardNo: "3OXlAnvi...",
    amount: 1000
});
```

#### 반환
- 성공 시
   ```typescript
   {
       success: true,
       message: "정상 처리되었습니다.",
       data: [
           {
               name: "홍길동",
               amount: 1000,
               accountNo: "1234..."
           }
       ]
   }
   ```
- 실패 시
   ```typescript
   {
       success: false,
       message: "실패 사유"
   }
   ```
</details>
