# Realtime Module

Gateway: Socket.IO namespace `/`

## Ket noi va auth

Client co the ket noi nhu sau:

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:8080", {
  auth: {
    token: "JWT_ACCESS_TOKEN"
  }
});
```

Token cung co the di qua header `Authorization: Bearer <token>` hoac query `token`, nhung `auth.token` la cach ro rang nhat.

## Rooms

- `workspace:{workspaceId}`: tat ca member cua workspace
- `conversation:{conversationId}`: tat ca member cua conversation
- `user:{userId}`: kenh rieng cho notification

## Client -> Server events

### `workspace:join`

- Payload: `workspaceId: string`
- Hanh vi: xac thuc user la member cua workspace, join room workspace va room user.
- Loi: `Not a workspace member`

### `conversation:join`

- Payload: `conversationId: string`
- Hanh vi: yeu cau client da join workspace truoc, sau do verify membership conversation roi join room conversation.
- Loi:
  - `Join a workspace before joining conversations`
  - `Not a conversation member`

### `conversation:leave`

- Payload: `conversationId: string`
- Hanh vi: leave room conversation.

### `typing:start`

- Payload: `conversationId: string`
- Hanh vi: verify membership va broadcast event `typing` cho cac socket khac trong conversation.

### `typing:stop`

- Payload: `conversationId: string`
- Hanh vi: hien tai dung chung luong broadcast voi `typing:start`.

## Server -> Client events

### `message:new`

```json
{
  "id": "message-id",
  "conversationId": "conversation-id",
  "parentId": null,
  "content": "Hello team",
  "isEdited": false,
  "isDeleted": false,
  "editedAt": null,
  "createdAt": "2026-06-09T10:00:00.000Z",
  "sender": {},
  "attachments": [],
  "replyCount": 0
}
```

### `message:updated`

- Payload co cung shape voi `message:new`.

### `message:deleted`

```json
{
  "id": "message-id",
  "conversationId": "conversation-id"
}
```

### `notification:new`

```json
{
  "id": "notification-id",
  "type": "MENTION",
  "workspaceId": "workspace-id",
  "conversationId": "conversation-id",
  "messageId": "message-id",
  "actorId": "user-id",
  "payload": {},
  "createdAt": "2026-06-09T10:00:00.000Z"
}
```

### `pinned:added`

```json
{
  "conversationId": "conversation-id",
  "messageId": "message-id",
  "pinnedBy": "user-id"
}
```

### `pinned:removed`

- Payload co cung shape voi `pinned:added`.

### `typing`

```json
{
  "conversationId": "conversation-id",
  "userId": "user-id",
  "displayName": "John Doe"
}
```

## Event duoc dinh nghia nhung chua thay emit trong gateway/service nay

- `reaction:added`
- `reaction:removed`
- `conversation:updated`
- `conversation:deleted`
- `member:joined`
- `member:left`
- `user:presence`

Nhung event tren da co type trong `socket-events.interface.ts`, nhung trong code duoc doc cho lan tai lieu nay chua thay luong emit thuc te tu `RealtimeGateway` hoac `RealtimeService`.
