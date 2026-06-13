import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from 'prisma/prisma.service';

export type PresenceLastSeenJobData = {
  userId: string;
  lastSeenAt: string;
};

/**
 * BullMQ worker that persists lastSeenAt to PostgreSQL on final disconnect.
 * Runs asynchronously so it does not block the Socket.IO disconnect handler.
 */
@Processor('presence-last-seen')
export class PresenceLastSeenProcessor extends WorkerHost {
  private readonly logger = new Logger(PresenceLastSeenProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<PresenceLastSeenJobData>): Promise<void> {
    const { userId, lastSeenAt } = job.data;

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date(lastSeenAt) },
    });

    this.logger.debug(`Persisted lastSeenAt for user ${userId}`);
  }
}
