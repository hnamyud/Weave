# Files Module

Controller prefix: `/api/v1/files`

Tat ca endpoint deu can Bearer JWT.

Ca hai endpoint dung chung schema file metadata:

```json
{
  "fileHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "fileName": "design.png",
  "fileType": "image/png",
  "fileSize": 12345,
  "storageKey": "uploads/design.png"
}
```

## POST /api/v1/files/check

- Mo ta: Kiem tra file metadata truoc khi upload/gan vao message.

## POST /api/v1/files/presign

- Mo ta: Tao presigned upload URL.

## Validation

- `fileHash`: SHA-256 lowercase hex, 64 ky tu
- `fileName`: bat buoc
- `fileType`: bat buoc
- `fileSize`: 1..15728640 bytes
- `storageKey`: optional
