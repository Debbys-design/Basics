import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { TxMonitorService } from '../services/tx-monitor.service';

export const MONITOR_TRANSACTIONS_QUEUE = 'monitor-transactions';
export const MONITOR_TRANSACTIONS_JOB = 'poll-pending-transactions';
const POLL_INTERVAL_MS = 5000;

@Injectable()
@Processor(MONITOR_TRANSACTIONS_QUEUE)
export class MonitorTransactionsJob extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(MonitorTransactionsJob.name);

  constructor(
    @InjectQueue(MONITOR_TRANSACTIONS_QUEUE)
    private readonly queue: Queue,
    private readonly txMonitorService: TxMonitorService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      MONITOR_TRANSACTIONS_JOB,
      {},
      {
        repeat: { every: POLL_INTERVAL_MS },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async process(job: Job): Promise<void> {
    if (job.name !== MONITOR_TRANSACTIONS_JOB) {
      return;
    }

    try {
      await this.txMonitorService.monitorPendingTransactions();
    } catch (error) {
      this.logger.error(`Transaction monitoring failed: ${error}`);
      throw error;
    }
  }
}
