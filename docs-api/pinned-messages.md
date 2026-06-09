# Pinned Messages Module

Controller routes không có prefix controller, nhưng tất cả đều nằm dưới `/api/v1`.

Tất cả endpoint đều cần Bearer JWT.

## POST /api/v1/messages/:messageId/pin

- Mô tả: Pin message vào conversation.

## DELETE /api/v1/messages/:messageId/pin

- Mô tả: Bỏ pin message.

## GET /api/v1/conversations/:conversationId/pinned-messages

- Mô tả: Lấy danh sách pinned message theo cursor.

### Query params

- `limit`: số nguyên >= 1
- `cursor`: optional
