# Messages Module

Controller routes không có prefix controller, nhưng tất cả đều nằm dưới `/api/v1`.

Tất cả endpoint đều cần Bearer JWT.

## POST /api/v1/messages

- Mô tả: Tạo message mới trong conversation.

### Body

```json
{
  "conversationId": "4e85bb0d-17c3-4cf2-bd75-18d92f76f7d4",
  "content": "Hello team",
  "attachments": [
    {
      "fileHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "fileName": "spec.pdf",
      "fileType": "application/pdf",
      "fileSize": 102400,
      "storageKey": "uploads/spec.pdf"
    }
  ],
  "mentionedUserIds": [
    "236100d1-83d0-4b94-a733-7cffdf4d3fd7"
  ]
}
```

### Ghi chú

- `content` là optional.
- `attachments` tối đa 4 phần tử.
- `mentionedUserIds` tối đa 20 UUID.

## GET /api/v1/conversations/:conversationId/messages

- Mô tả: Lấy danh sách message trong conversation theo cursor.

### Query params

- `limit`: số lượng bản ghi, số nguyên >= 1
- `cursor`: con trỏ phân trang

## GET /api/v1/messages/:messageId

- Mô tả: Lấy chi tiết một message.

## PATCH /api/v1/messages/:messageId

- Mô tả: Sửa nội dung message.

### Body

```json
{
  "content": "Updated content",
  "mentionedUserIds": [
    "236100d1-83d0-4b94-a733-7cffdf4d3fd7"
  ]
}
```

## DELETE /api/v1/messages/:messageId

- Mô tả: Xóa mềm message.

## POST /api/v1/messages/:messageId/replies

- Mô tả: Tạo thread reply cho message.

### Body

```json
{
  "content": "This is a reply",
  "attachments": [
    {
      "fileHash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "fileName": "image.png",
      "fileType": "image/png",
      "fileSize": 2048,
      "storageKey": "uploads/image.png"
    }
  ],
  "mentionedUserIds": []
}
```

### Ghi chú

- `attachments` trong reply tối đa 5 phần tử.

## GET /api/v1/messages/:messageId/replies

- Mô tả: Lấy danh sách reply của một message theo cursor.

### Query params

- `limit`: số lượng bản ghi, số nguyên >= 1
- `cursor`: con trỏ phân trang

## DELETE /api/v1/attachments/:id

- Mô tả: Xóa attachment khỏi message nếu user được phép.

## Lỗi thường gặp

- `400 Bad Request`: body sai schema, file metadata không hợp lệ
- `403 Forbidden`: không phải member conversation hoặc không đủ quyền sửa/xóa
- `404 Not Found`: message hoặc attachment không tồn tại
