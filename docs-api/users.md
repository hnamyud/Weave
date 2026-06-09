# Users Module

Controller prefix: `/api/v1/users`

Tat ca endpoint deu can Bearer JWT.

## GET /api/v1/users/me

- Policy: `RequireUserPermission(Action.Read)`
- Mo ta: Lay profile cua user dang dang nhap.

## GET /api/v1/users/:id

- Policy: `RequireUserPermission(Action.Read)`
- Mo ta: Lay profile cua user theo ID.

### Path params

- `id`: UUID cua user

## PATCH /api/v1/users/me

- Policy: `RequireUserPermission(Action.Update)`
- Mo ta: Cap nhat profile cua user hien tai.

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
- Mo ta: Soft-delete tai khoan hien tai.

## Loi thuong gap

- `401 Unauthorized`: thieu hoac sai JWT
- `403 Forbidden`: khong du policy truy cap
- `404 Not Found`: user khong ton tai
