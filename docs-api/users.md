# Users Module

Controller prefix: `/api/v1/users`

Tất cả endpoint đều cần Bearer JWT.

## GET /api/v1/users/me

- Policy: `RequireUserPermission(Action.Read)`
- Mô tả: Lấy profile của user đang đăng nhập.

## GET /api/v1/users/:id

- Policy: `RequireUserPermission(Action.Read)`
- Mô tả: Lấy profile của user theo ID.

### Path params

- `id`: UUID của user

## PATCH /api/v1/users/me

- Policy: `RequireUserPermission(Action.Update)`
- Mô tả: Cập nhật profile của user hiện tại.

### Body

```json
{
  "username": "johnny",
  "displayName": "John D",
  "avatarUrl": "https://example.com/avatar.png",
  "statusText": "In a meeting",
  "statusEmoji": ":spiral_calendar_pad:"
}
```

## DELETE /api/v1/users/me

- Policy: `RequireUserPermission(Action.Delete)`
- Mô tả: Soft-delete tài khoản hiện tại.

## Lỗi thường gặp

- `401 Unauthorized`: thiếu hoặc sai JWT
- `403 Forbidden`: không đủ policy truy cập
- `404 Not Found`: user không tồn tại
