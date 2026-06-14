# Realtime Module

Gateway: Socket.IO namespace `/`

## Kết nối và auth

Client có thể kết nối như sau:

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:8080", {
  auth: {
    token: "JWT_ACCESS_TOKEN"
  }
});
```

Token cũng có thể đi qua header `Authorization: Bearer <token>` hoặc query `token`, nhưng `auth.token` là cách rõ ràng nhất.

## Rooms

- `workspace:{workspaceId}`: tất cả member của workspace
- `conversation:{conversationId}`: tất cả member của conversation
- `user:{userId}`: kênh riêng cho notification

## Client -> Server events

### `workspace:join`

- Payload: `workspaceId: string`
- Ack: `{ joined: true, roomId: string }`
- Hành vi: xác thực user là member của workspace, join room workspace và room user.
- Lỗi: `Not a workspace member`

### `presence:join`

- Payload: `{ workspaceId: string }`
- Ack: `{ onlineUserIds: string[] }` — snapshot các user đang online trong workspace tại thời điểm join.
- Hành vi: đánh dấu user online trong workspace (lưu Redis). Nếu đây là socket đầu tiên của user trong workspace, broadcast `user:presence` (status `online`) cho các member khác. Khi user switch workspace, tự cleanup presence ở workspace cũ trước khi join cái mới.
- Lỗi: `Not a workspace member`
- Lưu ý: đây là event riêng, tách khỏi `workspace:join`. Muốn có online indicator thì sau khi `workspace:join` ack xong cần emit thêm `presence:join`.

### `conversation:join`

- Payload: `conversationId: string`
- Ack: `{ joined: true, roomId: string }`
- Hành vi: yêu cầu client đã join workspace trước, sau đó verify membership conversation rồi join room conversation.
- Lỗi:
  - `Join a workspace before joining conversations`
  - `Not a conversation member`

### `conversation:leave`

- Payload: `conversationId: string`
- Hành vi: leave room conversation.

### `typing:start`

- Payload: `conversationId: string`
- Hành vi: verify membership và broadcast event `typing` cho các socket khác trong conversation.

### `typing:stop`

- Payload: `conversationId: string`
- Hành vi: hiện tại dùng chung luồng broadcast với `typing:start`.

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

- Payload có cùng shape với `message:new`.

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

- Payload có cùng shape với `pinned:added`.

### `reaction:added`

```json
{
  "conversationId": "conversation-id",
  "messageId": "message-id",
  "userId": "user-id",
  "emoji": "👍",
  "user": {}
}
```

### `reaction:removed`

- Payload có cùng shape với `reaction:added`.

### `typing`

```json
{
  "conversationId": "conversation-id",
  "userId": "user-id",
  "displayName": "John Doe"
}
```

### `user:presence`

```json
{
  "userId": "user-id",
  "workspaceId": "workspace-id",
  "status": "online",
  "lastSeenAt": null
}
```

- Broadcast tới room `workspace:{workspaceId}`.
- `status` thực tế chỉ nhận `online` hoặc `offline`. Type có khai báo `away` nhưng gateway hiện **không bao giờ emit** `away`.
- `online`: emit khi user có socket đầu tiên join presence (`presence:join`). `lastSeenAt` = `null`.
- `offline`: emit khi socket cuối của user trong workspace disconnect hoặc khi user switch sang workspace khác. `lastSeenAt` = ISO timestamp, được persist vào DB (async qua BullMQ).

### `conversation:updated`

```json
{
  "id": "conversation-id",
  "workspaceId": "workspace-id",
  "name": "backend",
  "type": "CHANNEL",
  "isArchived": false,
  "isDeleted": false
}
```

- Broadcast tới room `workspace:{workspaceId}`.

### `conversation:deleted`

```json
{
  "id": "conversation-id"
}
```

- Broadcast tới room `workspace:{workspaceId}`.

### `workspace:deleted`

```json
{
  "id": "workspace-id"
}
```

- Broadcast tới room `workspace:{workspaceId}`.

### `member:joined`

```json
{
  "conversationId": "conversation-id",
  "user": {}
}
```

- Broadcast tới room `conversation:{conversationId}`.

### `member:left`

- Payload có cùng shape với `member:joined`.

## Event được định nghĩa nhưng chưa emit

- `presence:snapshot`: có khai báo hằng (`EVENTS.PRESENCE_SNAPSHOT`) và type, nhưng gateway/service **chưa emit**. Snapshot online users được trả qua **ack của `presence:join`** (`{ onlineUserIds }`), không qua event riêng. Client KHÔNG nên listen `presence:snapshot`.
