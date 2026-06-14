# Reactions Module

Controller routes không có prefix controller, nhưng tất cả đều nằm dưới `/api/v1`.

Tất cả endpoint đều cần Bearer JWT. User phải là member của workspace và conversation chứa message; nếu không sẽ trả `404 Message not found`.

## POST /api/v1/messages/:messageId/reactions

- Auth: Bearer JWT
- Mô tả: Toggle reaction cho message. Nếu reaction (cùng emoji của user) đã tồn tại thì trả về reaction cũ; nếu chưa thì tạo mới và emit realtime event `reaction:added`.

### Body

```json
{
  "emoji": "👍"
}
```

### Response

```json
{
  "statusCode": 201,
  "message": "Toggle reaction successfully!",
  "data": {
    "id": "reaction-id",
    "messageId": "message-id",
    "userId": "user-id",
    "emoji": "👍",
    "user": {}
  }
}
```

## GET /api/v1/messages/:messageId/reactions

- Auth: Bearer JWT
- Mô tả: Lấy tổng hợp reaction của message, gom nhóm theo emoji kèm số lượng và cờ user hiện tại đã react chưa.

### Response

```json
{
  "statusCode": 200,
  "message": "Get reactions successfully!",
  "data": [
    {
      "emoji": "👍",
      "count": 3,
      "reactedByMe": true
    }
  ]
}
```

## DELETE /api/v1/messages/:messageId/reactions/:emoji

- Auth: Bearer JWT
- Mô tả: Xóa reaction của user trên message và emit realtime event `reaction:removed`. Trả `404 Reaction not found` nếu user chưa từng react emoji đó.

### Response

```json
{
  "statusCode": 200,
  "message": "Remove reaction successfully!",
  "data": {
    "id": "reaction-id",
    "messageId": "message-id",
    "userId": "user-id",
    "emoji": "👍"
  }
}
```

## Ghi chú

- Emoji được truyền qua param trong endpoint DELETE, và qua body (`ReactionDto`) trong endpoint POST.
- Realtime: xem `reaction:added` và `reaction:removed` trong [realtime.md](realtime.md).
