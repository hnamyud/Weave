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
- Hành vi: xác thực user là member của workspace, join room workspace và room user.
- Lỗi: `Not a workspace member`

### `conversation:join`

- Payload: `conversationId: string`
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

### `typing`

```json
{
  "conversationId": "conversation-id",
  "userId": "user-id",
  "displayName": "John Doe"
}
```

## Event được định nghĩa nhưng chưa thấy emit trong gateway/service này

- `reaction:added`
- `reaction:removed`
- `conversation:updated`
- `conversation:deleted`
- `member:joined`
- `member:left`
- `user:presence`

Những event trên đã có type trong `socket-events.interface.ts`, nhưng trong code được đọc cho lần tài liệu này chưa thấy luồng emit thực tế từ `RealtimeGateway` hoặc `RealtimeService`.
