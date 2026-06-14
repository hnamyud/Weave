// Inter-server events for socket.io.
//
// SINGLE-NODE ONLY: this app currently runs as a single instance, so the
// default in-memory adapter is used and there are no inter-server events.
// Presence STATE lives in Redis (see PresenceService) for queryability, but
// USER_PRESENCE broadcasts only reach sockets on this process. If you ever
// scale to multiple instances, wire up @socket.io/redis-adapter and populate
// this type — otherwise presence events will silently fail to fan out across
// nodes (getOnlineUsers stays correct, but clients on other nodes never get
// the event).
export type InterServerEvents = Record<string, never>;
