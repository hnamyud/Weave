# Weave API Documentation

Tài liệu này mô tả các REST API và Socket.IO event đang được expose trong backend Weave.

## Tổng quan

- Base REST URL: `http://localhost:8080/api/v1`
- Swagger UI: `http://localhost:8080/docs`
- Socket.IO namespace: `/`
- Hình thức xác thực mặc định: `Authorization: Bearer <access_token>`

## Response wrapper

Tất cả HTTP response từ controller đều đi qua `TransformInterceptor` và có dạng:

```json
{
  "statusCode": 200,
  "message": "Human readable message",
  "data": {}
}
```

Lỗi validation, auth, permission và resource not found được trả về bởi exception/filter toàn cục.

## Auth

- Endpoint có `@Public()` không cần JWT.
- Phần lớn endpoint cần JWT Bearer token.
- Refresh token được dùng qua cookie `refresh_token`.
- Socket.IO có thể nhận token qua:
  - `handshake.auth.token`
  - header `Authorization: Bearer <token>`
  - query `token`

## Tài liệu theo module

- [auth.md](/D:/Weave/docs-api/auth.md)
- [users.md](/D:/Weave/docs-api/users.md)
- [workspaces.md](/D:/Weave/docs-api/workspaces.md)
- [workspace-members.md](/D:/Weave/docs-api/workspace-members.md)
- [workspace-invite.md](/D:/Weave/docs-api/workspace-invite.md)
- [conversations.md](/D:/Weave/docs-api/conversations.md)
- [conversation-members.md](/D:/Weave/docs-api/conversation-members.md)
- [messages.md](/D:/Weave/docs-api/messages.md)
- [files.md](/D:/Weave/docs-api/files.md)
- [notifications.md](/D:/Weave/docs-api/notifications.md)
- [pinned-messages.md](/D:/Weave/docs-api/pinned-messages.md)
- [mailer.md](/D:/Weave/docs-api/mailer.md)
- [realtime.md](/D:/Weave/docs-api/realtime.md)
- [reactions.md](/D:/Weave/docs-api/reactions.md)
- [search.md](/D:/Weave/docs-api/search.md)
- [tokens.md](/D:/Weave/docs-api/tokens.md)
