import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

// Redis key builders
const KEYS = {
  userSockets: (userId: string) => `presence:user:${userId}`,
  workspaceOnline: (workspaceId: string) => `presence:workspace:${workspaceId}`,
  socketMeta: (socketId: string) => `presence:socket:${socketId}`,
} as const;

export type HandleDisconnectResult = {
  userId: string;
  workspaceId: string;
  isLastPresenceInWorkspace: boolean;
};

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Register a socket joining a workspace presence room.
   *
   * Redis ops:
   *  - SADD presence:user:{userId}                 ← add socketId
   *  - SADD presence:workspace:{workspaceId}        ← mark user online
   *  - HSET presence:socket:{socketId}              ← store metadata
   *
   * Returns { isFirstPresenceInWorkspace } so the gateway knows whether
   * to broadcast a USER_PRESENCE online event.
   */
  async handleJoin(
    userId: string,
    socketId: string,
    workspaceId: string,
  ): Promise<{ isFirstPresenceInWorkspace: boolean }> {
    const pipeline = this.redis.pipeline();
    pipeline.sadd(KEYS.userSockets(userId), socketId);
    pipeline.sadd(KEYS.workspaceOnline(workspaceId), userId);
    pipeline.hset(KEYS.socketMeta(socketId), {
      userId,
      workspaceId,
    });
    const results = await pipeline.exec();

    // results[0][1] is the return value of SADD on userSockets:
    // 1 = this socketId was newly added, but that is per-socket.
    // We need to know if this user just appeared in the workspace set.
    // results[1][1] is SADD return for workspaceOnline: 1 = newly added.
    const addedToWorkspace = (results?.[1]?.[1] as number) === 1;

    return { isFirstPresenceInWorkspace: addedToWorkspace };
  }

  /**
   * Remove a socket from workspace presence.
   *
   * Logic:
   * 1. SREM presence:user:{userId} socketId
   * 2. DEL  presence:socket:{socketId}
   * 3. SMEMBERS presence:user:{userId}  — get remaining socketIds
   * 4. If empty → user should leave the workspace set
   * 5. Else iterate remaining sockets (pipeline HGET) to check if any
   *    still belong to this workspaceId. If none → user should leave.
   *
   * The offline decision is gated on the atomic SREM return value, NOT on the
   * "no sockets remaining" read above. SREM returns 1 only for the caller that
   * actually removed the user from the workspace set, so isLastPresenceInWorkspace
   * is exactly-once even when handleLeave runs concurrently for the same socket
   * (e.g. a workspace switch racing the socket disconnect). This is what prevents
   * a double USER_PRESENCE offline broadcast.
   */
  async handleLeave(
    userId: string,
    socketId: string,
    workspaceId: string,
  ): Promise<{ isLastPresenceInWorkspace: boolean }> {
    // Remove socket from user set and delete metadata
    await this.redis
      .pipeline()
      .srem(KEYS.userSockets(userId), socketId)
      .del(KEYS.socketMeta(socketId))
      .exec();

    // Get remaining socket IDs for this user
    const remainingSocketIds = await this.redis.smembers(
      KEYS.userSockets(userId),
    );

    let shouldLeaveWorkspace: boolean;
    if (remainingSocketIds.length === 0) {
      // No sockets left at all
      shouldLeaveWorkspace = true;
    } else {
      // Check if any remaining socket belongs to this workspace
      const pipeline = this.redis.pipeline();
      for (const sid of remainingSocketIds) {
        pipeline.hget(KEYS.socketMeta(sid), 'workspaceId');
      }
      const metaResults = await pipeline.exec();

      const stillInWorkspace = metaResults?.some(
        ([err, val]) => !err && val === workspaceId,
      );
      shouldLeaveWorkspace = !stillInWorkspace;
    }

    if (!shouldLeaveWorkspace) {
      return { isLastPresenceInWorkspace: false };
    }

    // Atomic gate: only the caller whose SREM actually removed the user reports
    // isLast=true, guaranteeing a single offline broadcast under concurrency.
    const removed = await this.redis.srem(
      KEYS.workspaceOnline(workspaceId),
      userId,
    );
    return { isLastPresenceInWorkspace: removed === 1 };
  }

  /**
   * Handle socket disconnect by reading stored metadata and delegating to handleLeave.
   * Returns null if the socket had no presence metadata (e.g. never joined a workspace).
   */
  async handleDisconnect(
    socketId: string,
  ): Promise<HandleDisconnectResult | null> {
    const meta = await this.redis.hgetall(KEYS.socketMeta(socketId));

    if (!meta?.userId || !meta?.workspaceId) {
      // Socket never joined presence — clean up key just in case
      await this.redis.del(KEYS.socketMeta(socketId));
      return null;
    }

    const { userId, workspaceId } = meta;

    const { isLastPresenceInWorkspace } = await this.handleLeave(
      userId,
      socketId,
      workspaceId,
    );

    return { userId, workspaceId, isLastPresenceInWorkspace };
  }

  async forceLeaveWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<{ affectedSocketIds: string[] }> {
    const socketIds = await this.redis.smembers(KEYS.userSockets(userId));

    if (socketIds.length === 0) {
      await this.redis.srem(KEYS.workspaceOnline(workspaceId), userId);
      return { affectedSocketIds: [] };
    }

    const lookupPipeline = this.redis.pipeline();
    for (const socketId of socketIds) {
      lookupPipeline.hget(KEYS.socketMeta(socketId), 'workspaceId');
    }
    const workspaceResults = await lookupPipeline.exec();

    const affectedSocketIds = socketIds.filter((socketId, index) => {
      const result = workspaceResults?.[index];
      return !result?.[0] && result?.[1] === workspaceId;
    });

    if (affectedSocketIds.length > 0) {
      const cleanupPipeline = this.redis.pipeline();
      for (const socketId of affectedSocketIds) {
        cleanupPipeline.del(KEYS.socketMeta(socketId));
        cleanupPipeline.srem(KEYS.userSockets(userId), socketId);
      }
      await cleanupPipeline.exec();
    }

    await this.redis.srem(KEYS.workspaceOnline(workspaceId), userId);

    return { affectedSocketIds };
  }

  async clearWorkspace(
    workspaceId: string,
  ): Promise<{ affectedUserIds: string[] }> {
    const affectedUserIds = await this.redis.smembers(
      KEYS.workspaceOnline(workspaceId),
    );

    for (const userId of affectedUserIds) {
      await this.forceLeaveWorkspace(userId, workspaceId);
    }

    await this.redis.del(KEYS.workspaceOnline(workspaceId));

    return { affectedUserIds };
  }

  /**
   * Returns all userIds currently online in a workspace.
   * Uses SMEMBERS — O(N) where N = number of online members.
   */
  async getOnlineUsers(workspaceId: string): Promise<string[]> {
    return this.redis.smembers(KEYS.workspaceOnline(workspaceId));
  }

  /**
   * Returns true if the user has at least one active socket.
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const count = await this.redis.scard(KEYS.userSockets(userId));
    return count > 0;
  }
}
