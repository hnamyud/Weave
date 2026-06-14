# Notifications Module

Controller routes không có prefix controller, nhưng tất cả đều nằm dưới `/api/v1`.

Tất cả endpoint đều cần Bearer JWT.

## GET /api/v1/notifications

- Mô tả: Lấy danh sách notification theo cursor/filter.

### Query params

- `workspaceId`: UUID, optional
- `isRead`: chuỗi boolean `true` hoặc `false`, optional
- `limit`: số nguyên >= 1, optional
- `cursor`: optional

## PATCH /api/v1/notifications/:id/read

- Mô tả: Đánh dấu một notification là đã đọc.

## PATCH /api/v1/notifications/read-all

- Mô tả: Đánh dấu tất cả notification là đã đọc, có thể giới hạn theo workspace.

### Query params

- `workspaceId`: UUID, optional

## DELETE /api/v1/notifications/:id

- Mô tả: Xóa một notification.

## DELETE /api/v1/notifications

- Mô tả: Xóa tất cả notification, có thể giới hạn theo workspace.

### Query params

- `workspaceId`: UUID, optional

## GET /api/v1/workspaces/:workspaceId/notification-settings

- Mô tả: Lấy notification settings của user trong workspace.

### Path params

- `workspaceId`: UUID, bắt buộc

## PATCH /api/v1/workspaces/:workspaceId/notification-settings

- Mô tả: Cập nhật notification settings của user trong workspace.

### Path params

- `workspaceId`: UUID, bắt buộc

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
