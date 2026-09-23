import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Transaction,
  TransactionStatus,
} from '../entities/transaction.entity';

export interface HorizonTransactionResponse {
  successful: boolean;
  ledger: number;
  fee_charged: string;
  hash: string;
}

export interface TxStatusChange {
  transactionId: string;
  tradeId: string | null;
  hash: string;
  status: TransactionStatus;
  ledger: number | null;
  feePaid: string | null;
  receipt: Record<string, unknown> | null;
}

const HORIZON_URL =
  process.env.HORIZON_URL ?? 'https://horizon.stellar.org';
const MAX_ATTEMPTS = 5;

export type StatusChangeHandler = (change: TxStatusChange) => void;

@Injectable()
export class TxMonitorService {
  private readonly logger = new Logger(TxMonitorService.name);
  private readonly handlers: StatusChangeHandler[] = [];

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  onStatusChange(handler: StatusChangeHandler): void {
    this.handlers.push(handler);
  }

  private emit(change: TxStatusChange): void {
    for (const handler of this.handlers) {
      try {
        handler(change);
      } catch (error) {
        this.logger.error(`Status change handler failed: ${error}`);
      }
    }
  }

  async fetchHorizonTransaction(
    hash: string,
  ): Promise<HorizonTransactionResponse | null> {
    try {
      const response = await fetch(`${HORIZON_URL}/transactions/${hash}`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Horizon responded with ${response.status}`);
      }
      return (await response.json()) as HorizonTransactionResponse;
    } catch (error) {
      this.logger.warn(`Horizon lookup failed for ${hash}: ${error}`);
      return null;
    }
  }

  async monitorPendingTransactions(): Promise<void> {
    const pending = await this.transactionRepository.find({
      where: { status: TransactionStatus.PENDING },
    });

    for (const transaction of pending) {
      await this.checkTransaction(transaction);
    }
  }

  async checkTransaction(transaction: Transaction): Promise<void> {
    const horizon = await this.fetchHorizonTransaction(transaction.hash);

    if (!horizon) {
      await this.handleStuckTransaction(transaction);
      return;
    }

    if (!horizon.successful) {
      await this.markFailed(transaction, 'Transaction rejected by network');
      return;
    }

    await this.markConfirmed(transaction, horizon);
  }

  private async handleStuckTransaction(transaction: Transaction): Promise<void> {
    const attempts = transaction.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await this.markFailed(
        transaction,
        'Transaction stuck in pending beyond retry limit',
      );
      return;
    }

    transaction.attempts = attempts;
    await this.transactionRepository.save(transaction);
    this.logger.warn(
      `Transaction ${transaction.hash} still pending (attempt ${attempts})`,
    );
  }

  private async markConfirmed(
    transaction: Transaction,
    horizon: HorizonTransactionResponse,
  ): Promise<void> {
    transaction.status = TransactionStatus.CONFIRMED;
    transaction.ledger = horizon.ledger;
    transaction.feePaid = horizon.fee_charged;
    transaction.confirmedAt = new Date();
    transaction.receipt = this.buildReceipt(transaction, horizon);
    await this.transactionRepository.save(transaction);

    this.emit({
      transactionId: transaction.id,
      tradeId: transaction.tradeId,
      hash: transaction.hash,
      status: TransactionStatus.CONFIRMED,
      ledger: transaction.ledger,
      feePaid: transaction.feePaid,
      receipt: transaction.receipt,
    });
  }

  async markSettled(transaction: Transaction): Promise<void> {
    transaction.status = TransactionStatus.SETTLED;
    transaction.settledAt = new Date();
    await this.transactionRepository.save(transaction);

    this.emit({
      transactionId: transaction.id,
      tradeId: transaction.tradeId,
      hash: transaction.hash,
      status: TransactionStatus.SETTLED,
      ledger: transaction.ledger,
      feePaid: transaction.feePaid,
      receipt: transaction.receipt,
    });
  }

  async markFailed(transaction: Transaction, reason: string): Promise<void> {
    transaction.status = TransactionStatus.FAILED;
    transaction.failureReason = reason;
    await this.transactionRepository.save(transaction);

    this.emit({
      transactionId: transaction.id,
      tradeId: transaction.tradeId,
      hash: transaction.hash,
      status: TransactionStatus.FAILED,
      ledger: transaction.ledger,
      feePaid: transaction.feePaid,
      receipt: transaction.receipt,
    });
  }

  private buildReceipt(
    transaction: Transaction,
    horizon: HorizonTransactionResponse,
  ): Record<string, unknown> {
    return {
      hash: transaction.hash,
      tradeId: transaction.tradeId,
      ledger: horizon.ledger,
      feePaid: horizon.fee_charged,
      status: TransactionStatus.CONFIRMED,
      confirmedAt: transaction.confirmedAt?.toISOString() ?? null,
    };
  }
}
