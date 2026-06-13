import { beforeEach, describe, expect, it } from '@jest/globals';
import { PresenceService } from './presence.service';

type PipelineCommand =
  | { type: 'sadd'; key: string; value: string }
  | { type: 'srem'; key: string; value: string }
  | { type: 'hset'; key: string; value: Record<string, string> }
  | { type: 'hget'; key: string; field: string }
  | { type: 'del'; key: string };

class RedisFake {
  sets = new Map<string, Set<string>>();
  hashes = new Map<string, Record<string, string>>();

  pipeline(): RedisPipelineFake {
    return new RedisPipelineFake(this);
  }

  sadd(key: string, value: string): number {
    const set = this.sets.get(key) ?? new Set<string>();
    const existed = set.has(value);
    set.add(value);
    this.sets.set(key, set);
    return existed ? 0 : 1;
  }

  srem(key: string, value: string): number {
    const set = this.sets.get(key);
    if (!set) return 0;
    const removed = set.delete(value);
    if (set.size === 0) this.sets.delete(key);
    return removed ? 1 : 0;
  }

  smembers(key: string): string[] {
    return Array.from(this.sets.get(key) ?? []);
  }

  scard(key: string): number {
    return this.sets.get(key)?.size ?? 0;
  }

  hset(key: string, value: Record<string, string>): number {
    this.hashes.set(key, { ...(this.hashes.get(key) ?? {}), ...value });
    return Object.keys(value).length;
  }

  hget(key: string, field: string): string | null {
    return this.hashes.get(key)?.[field] ?? null;
  }

  hgetall(key: string): Record<string, string> {
    return this.hashes.get(key) ?? {};
  }

  del(key: string): number {
    const deletedSet = this.sets.delete(key);
    const deletedHash = this.hashes.delete(key);
    return deletedSet || deletedHash ? 1 : 0;
  }
}

class RedisPipelineFake {
  private readonly commands: PipelineCommand[] = [];

  constructor(private readonly redis: RedisFake) {}

  sadd(key: string, value: string): this {
    this.commands.push({ type: 'sadd', key, value });
    return this;
  }

  srem(key: string, value: string): this {
    this.commands.push({ type: 'srem', key, value });
    return this;
  }

  hset(key: string, value: Record<string, string>): this {
    this.commands.push({ type: 'hset', key, value });
    return this;
  }

  hget(key: string, field: string): this {
    this.commands.push({ type: 'hget', key, field });
    return this;
  }

  del(key: string): this {
    this.commands.push({ type: 'del', key });
    return this;
  }

  exec(): Array<[Error | null, unknown]> {
    const results: Array<[Error | null, unknown]> = [];

    for (const command of this.commands) {
      if (command.type === 'sadd') {
        results.push([null, this.redis.sadd(command.key, command.value)]);
      }
      if (command.type === 'srem') {
        results.push([null, this.redis.srem(command.key, command.value)]);
      }
      if (command.type === 'hset') {
        results.push([null, this.redis.hset(command.key, command.value)]);
      }
      if (command.type === 'hget') {
        results.push([null, this.redis.hget(command.key, command.field)]);
      }
      if (command.type === 'del') {
        results.push([null, this.redis.del(command.key)]);
      }
    }

    return results;
  }
}

describe('PresenceService', () => {
  let redis: RedisFake;
  let service: PresenceService;

  beforeEach(() => {
    redis = new RedisFake();
    service = new PresenceService(redis as never);
  });

  it('registers a first workspace presence and exposes the online user', async () => {
    const result = await service.handleJoin('user-id', 'socket-1', 'ws-1');

    expect(result).toEqual({ isFirstPresenceInWorkspace: true });
    await expect(service.getOnlineUsers('ws-1')).resolves.toEqual(['user-id']);
    await expect(service.isUserOnline('user-id')).resolves.toBe(true);
    expect(redis.hashes.get('presence:socket:socket-1')).toEqual({
      userId: 'user-id',
      workspaceId: 'ws-1',
    });
  });

  it('does not treat a second tab in the same workspace as first presence', async () => {
    await service.handleJoin('user-id', 'socket-1', 'ws-1');

    const result = await service.handleJoin('user-id', 'socket-2', 'ws-1');

    expect(result).toEqual({ isFirstPresenceInWorkspace: false });
    await expect(service.getOnlineUsers('ws-1')).resolves.toEqual(['user-id']);
  });

  it('keeps the user online in a workspace while another socket remains there', async () => {
    await service.handleJoin('user-id', 'socket-1', 'ws-1');
    await service.handleJoin('user-id', 'socket-2', 'ws-1');

    const result = await service.handleLeave('user-id', 'socket-1', 'ws-1');

    expect(result).toEqual({ isLastPresenceInWorkspace: false });
    await expect(service.getOnlineUsers('ws-1')).resolves.toEqual(['user-id']);
    expect(redis.hashes.has('presence:socket:socket-1')).toBe(false);
  });

  it('removes the user from workspace presence when the last workspace socket leaves', async () => {
    await service.handleJoin('user-id', 'socket-1', 'ws-1');

    const result = await service.handleLeave('user-id', 'socket-1', 'ws-1');

    expect(result).toEqual({ isLastPresenceInWorkspace: true });
    await expect(service.getOnlineUsers('ws-1')).resolves.toEqual([]);
    await expect(service.isUserOnline('user-id')).resolves.toBe(false);
  });

  it('removes only the old workspace when the same socket switches workspaces', async () => {
    await service.handleJoin('user-id', 'socket-1', 'ws-1');
    const leaveResult = await service.handleLeave(
      'user-id',
      'socket-1',
      'ws-1',
    );
    const joinResult = await service.handleJoin('user-id', 'socket-1', 'ws-2');

    expect(leaveResult).toEqual({ isLastPresenceInWorkspace: true });
    expect(joinResult).toEqual({ isFirstPresenceInWorkspace: true });
    await expect(service.getOnlineUsers('ws-1')).resolves.toEqual([]);
    await expect(service.getOnlineUsers('ws-2')).resolves.toEqual(['user-id']);
  });

  it('returns null for disconnects without presence metadata', async () => {
    await expect(
      service.handleDisconnect('missing-socket'),
    ).resolves.toBeNull();
  });

  it('force leaves only sockets for the requested workspace', async () => {
    await service.handleJoin('user-id', 'socket-1', 'ws-1');
    await service.handleJoin('user-id', 'socket-2', 'ws-1');
    await service.handleJoin('user-id', 'socket-3', 'ws-2');

    const result = await service.forceLeaveWorkspace('user-id', 'ws-1');

    expect(result).toEqual({ affectedSocketIds: ['socket-1', 'socket-2'] });
    await expect(service.getOnlineUsers('ws-1')).resolves.toEqual([]);
    await expect(service.getOnlineUsers('ws-2')).resolves.toEqual(['user-id']);
    expect(redis.hashes.has('presence:socket:socket-1')).toBe(false);
    expect(redis.hashes.has('presence:socket:socket-2')).toBe(false);
    expect(redis.hashes.get('presence:socket:socket-3')).toEqual({
      userId: 'user-id',
      workspaceId: 'ws-2',
    });
    await expect(service.isUserOnline('user-id')).resolves.toBe(true);
  });

  it('clears a workspace and removes socket metadata for its online users', async () => {
    await service.handleJoin('user-1', 'socket-1', 'ws-1');
    await service.handleJoin('user-2', 'socket-2', 'ws-1');
    await service.handleJoin('user-2', 'socket-3', 'ws-2');

    const result = await service.clearWorkspace('ws-1');

    expect(result).toEqual({ affectedUserIds: ['user-1', 'user-2'] });
    await expect(service.getOnlineUsers('ws-1')).resolves.toEqual([]);
    await expect(service.getOnlineUsers('ws-2')).resolves.toEqual(['user-2']);
    expect(redis.hashes.has('presence:socket:socket-1')).toBe(false);
    expect(redis.hashes.has('presence:socket:socket-2')).toBe(false);
    expect(redis.hashes.get('presence:socket:socket-3')).toEqual({
      userId: 'user-2',
      workspaceId: 'ws-2',
    });
  });
});
