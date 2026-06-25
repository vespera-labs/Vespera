// FIX #29: Remove hardcoded NGN currency and 2% fee
// Bug: recordPayment hardcodes currency NGN and transactionFee = amount * 0.02
// Fix: Derive currency from DTO/payment method, use configurable fee rate

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface PaymentRecordDto {
  amount: number;
  currency: string;  // Must be provided - no more default NGN
  paymentMethodId: string;
  tenantId: string;
  agreementId: string;
}

@Injectable()
export class PaymentService {
  private readonly feeRate: number;
  private readonly supportedCurrencies = ["NGN", "USD", "EUR", "GBP", "XLM"];

  constructor(private config: ConfigService) {
    // Fee rate from config, default 2% if unset
    this.feeRate = this.config.get<number>("PAYMENT_FEE_RATE", 0.02);
  }

  async recordPayment(dto: PaymentRecordDto) {
    // FIXED: Validate currency from DTO instead of hardcoding NGN
    if (!this.supportedCurrencies.includes(dto.currency)) {
      throw new Error(
        ,
      );
    }

    // FIXED: Use configurable fee rate instead of hardcoded 0.02
    const transactionFee = dto.amount * this.feeRate;
    const netAmount = dto.amount - transactionFee;

    const payment = {
      tenantId: dto.tenantId,
      agreementId: dto.agreementId,
      amount: dto.amount,
      currency: dto.currency,  // FIXED: actual currency, not hardcoded NGN
      transactionFee,
      feeRate: this.feeRate,
      netAmount,
      status: "completed",
      createdAt: new Date(),
    };

    // Save payment record
    await this.paymentRepo.save(payment);

    // FIXED: Notification uses actual currency
    await this.notificationService.sendPaymentConfirmation({
      tenantId: dto.tenantId,
      amount: dto.amount,
      currency: dto.currency,  // No more hardcoded NGN in emails
      fee: transactionFee,
    });

    return payment;
  }
}
