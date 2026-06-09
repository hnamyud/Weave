# Messages Module

Controller routes khong co prefix controller, nhung tat ca deu nam duoi `/api/v1`.

Tat ca endpoint deu can Bearer JWT.

## POST /api/v1/messages

- Mo ta: Tao message moi trong conversation.

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

### Ghi chu

- `content` la optional.
- `attachments` toi da 4 phan tu.
- `mentionedUserIds` toi da 20 UUID.

## GET /api/v1/conversations/:conversationId/messages

- Mo ta: Lay danh sach message trong conversation theo cursor.

### Query params

- `limit`: so luong ban ghi, so nguyen >= 1
- `cursor`: con tro phan trang

## GET /api/v1/messages/:messageId

- Mo ta: Lay chi tiet mot message.

## PATCH /api/v1/messages/:messageId

- Mo ta: Sua noi dung message.

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

- Mo ta: Xoa mem message.

## POST /api/v1/messages/:messageId/replies

- Mo ta: Tao thread reply cho message.

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

### Ghi chu

- `attachments` trong reply toi da 5 phan tu.

## GET /api/v1/messages/:messageId/replies

- Mo ta: Lay danh sach reply cua mot message theo cursor.

### Query params

- `limit`: so luong ban ghi, so nguyen >= 1
- `cursor`: con tro phan trang

## DELETE /api/v1/attachments/:id

- Mo ta: Xoa attachment khoi message neu user duoc phep.

## Loi thuong gap

- `400 Bad Request`: body sai schema, file metadata khong hop le
- `403 Forbidden`: khong phai member conversation hoac khong du quyen sua/xoa
- `404 Not Found`: message hoac attachment khong ton tai
