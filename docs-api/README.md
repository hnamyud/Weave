# Weave API Documentation

Tai lieu nay mo ta cac REST API va Socket.IO event dang duoc expose trong backend Weave.

## Tong quan

- Base REST URL: `http://localhost:8080/api/v1`
- Swagger UI: `http://localhost:8080/docs`
- Socket.IO namespace: `/`
- Hinh thuc xac thuc mac dinh: `Authorization: Bearer <access_token>`

## Response wrapper

Tat ca HTTP response tu controller deu di qua `TransformInterceptor` va co dang:

```json
{
  "statusCode": 200,
  "message": "Human readable message",
  "data": {}
}
```

Loi validation, auth, permission va resource not found duoc tra ve boi exception/filter toan cuc.

## Auth

- Endpoint co `@Public()` khong can JWT.
- Phan lon endpoint can JWT Bearer token.
- Refresh token duoc dung qua cookie `refresh_token`.
- Socket.IO co the nhan token qua:
  - `handshake.auth.token`
  - header `Authorization: Bearer <token>`
  - query `token`

## Tai lieu theo module

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
