# Auth Module

Controller prefix: `/api/v1/auth`

## POST /api/v1/auth/login

- Auth: Public
- Mô tả: Đăng nhập bằng email và mật khẩu. Service có thể set `refresh_token` cookie và trả access token trong `data`.

### Body

```json
{
  "email": "admin@gmail.com",
  "password": "12345678"
}
```

### Response

```json
{
  "statusCode": 200,
  "message": "Login successful!",
  "data": {
    "accessToken": "jwt-token",
    "user": {}
  }
}
```

## POST /api/v1/auth/logout

- Auth: Bearer JWT
- Mô tả: Đăng xuất phiên hiện tại bằng `refresh_token` cookie.

## POST /api/v1/auth/logout-all

- Auth: Bearer JWT
- Mô tả: Thu hồi các refresh token khác của cùng user, giữ lại thiết bị hiện tại nếu service cho phép.

## POST /api/v1/auth/register

- Auth: Public
- Mô tả: Đăng ký tài khoản local.

### Body

```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123",
  "displayName": "John Doe"
}
```

## POST /api/v1/auth/verify-otp

- Auth: Public
- Mô tả: Xác minh OTP cho luồng reset/change email.

### Body

```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```

### Response

```json
{
  "statusCode": 201,
  "message": "OTP verified successfully!",
  "data": {
    "verified": true
  }
}
```

## POST /api/v1/auth/reset-password

- Auth: Public
- Mô tả: Đặt lại mật khẩu bằng email + OTP.

### Body

```json
{
  "email": "john@example.com",
  "otp": "123456",
  "newPassword": "newpassword123"
}
```

## POST /api/v1/auth/change-password

- Auth: Bearer JWT
- Policy: `RequireUserPermission(Action.Update)`
- Mô tả: Đổi mật khẩu của user hiện tại.

### Body

```json
{
  "oldPassword": "oldpassword",
  "newPassword": "newpassword123",
  "confirmPassword": "newpassword123"
}
```

## POST /api/v1/auth/change-email

- Auth: Bearer JWT
- Policy: `RequireUserPermission(Action.Update)`
- Mô tả: Đổi email của user hiện tại sau khi có OTP.

### Body

```json
{
  "newEmail": "new@example.com",
  "otp": "123456"
}
```

## POST /api/v1/auth/refresh

- Auth: Public
- Mô tả: Tạo access token mới từ `refresh_token` cookie.

### Lỗi thường gặp

- `401 Unauthorized`: thiếu cookie hoặc refresh token hết hạn/không hợp lệ.

## GET /api/v1/auth/google/login

- Auth: Public
- Guard: `GoogleAuthGuard`
- Mô tả: Redirect trình duyệt sang Google OAuth.

## GET /api/v1/auth/google/callback

- Auth: Public
- Guard: `GoogleAuthGuard`
- Mô tả: Nhận callback từ Google, đăng nhập user và redirect về frontend.

## Ghi chú

- Validation pipe đang bật `whitelist` và `forbidNonWhitelisted`.
- Endpoint auth public vẫn có response wrapper nếu controller trả JSON thay vì redirect.
