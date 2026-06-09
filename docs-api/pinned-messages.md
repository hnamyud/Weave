# Pinned Messages Module

Controller routes khong co prefix controller, nhung tat ca deu nam duoi `/api/v1`.

Tat ca endpoint deu can Bearer JWT.

## POST /api/v1/messages/:messageId/pin

- Mo ta: Pin message vao conversation.

## DELETE /api/v1/messages/:messageId/pin

- Mo ta: Bo pin message.

## GET /api/v1/conversations/:conversationId/pinned-messages

- Mo ta: Lay danh sach pinned message theo cursor.

### Query params

- `limit`: so nguyen >= 1
- `cursor`: optional
