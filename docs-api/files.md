# Files Module

Controller prefix: `/api/v1/files`

Tất cả endpoint đều cần Bearer JWT.

Cả hai endpoint dùng chung schema file metadata:

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

- Mô tả: Kiểm tra file metadata trước khi upload/gắn vào message.

## POST /api/v1/files/presign

- Mô tả: Tạo presigned upload URL.

## Validation

- `fileHash`: SHA-256 lowercase hex, 64 ký tự
- `fileName`: bắt buộc
- `fileType`: bắt buộc
- `fileSize`: 1..15728640 bytes
- `storageKey`: optional
