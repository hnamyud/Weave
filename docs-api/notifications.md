# Notifications Module

Controller routes khong co prefix controller, nhung tat ca deu nam duoi `/api/v1`.

Tat ca endpoint deu can Bearer JWT.

## GET /api/v1/notifications

- Mo ta: Lay danh sach notification theo cursor/filter.

### Query params

- `workspaceId`: UUID, optional
- `isRead`: chuoi boolean `true` hoac `false`, optional
- `limit`: so nguyen >= 1, optional
- `cursor`: optional

## PATCH /api/v1/notifications/:id/read

- Mo ta: Danh dau mot notification la da doc.

## PATCH /api/v1/notifications/read-all

- Mo ta: Danh dau tat ca notification la da doc, co the gioi han theo workspace.

### Query params

- `workspaceId`: UUID, optional

## DELETE /api/v1/notifications/:id

- Mo ta: Xoa mot notification.

## DELETE /api/v1/notifications

- Mo ta: Xoa tat ca notification, co the gioi han theo workspace.

### Query params

- `workspaceId`: UUID, optional

## GET /api/v1/notification-settings

- Mo ta: Lay notification settings cua user trong workspace.

### Query params

- `workspaceId`: UUID, bat buoc

## PATCH /api/v1/notification-settings

- Mo ta: Cap nhat notification settings cua user trong workspace.

### Query params

- `workspaceId`: UUID, bat buoc

### Body

```json
{
  "notifyMentions": true,
  "notifyDirectMessages": true,
  "notifyAllMessages": false,
  "emailNotifications": true,
  "pushNotifications": false
}
```
