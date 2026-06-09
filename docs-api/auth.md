# Auth Module

Controller prefix: `/api/v1/auth`

## POST /api/v1/auth/login

- Auth: Public
- Mo ta: Dang nhap bang email va mat khau. Service co the set `refresh_token` cookie va tra access token trong `data`.

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
- Mo ta: Dang xuat phien hien tai bang `refresh_token` cookie.

## POST /api/v1/auth/logout-all

- Auth: Bearer JWT
- Mo ta: Thu hoi cac refresh token khac cua cung user, giu lai thiet bi hien tai neu service cho phep.

## POST /api/v1/auth/register

- Auth: Public
- Mo ta: Dang ky tai khoan local.

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
- Mo ta: Xac minh OTP cho luong reset/change email.

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
- Mo ta: Dat lai mat khau bang email + OTP.

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
- Mo ta: Doi mat khau cua user hien tai.

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
- Mo ta: Doi email cua user hien tai sau khi co OTP.

### Body

```json
{
  "newEmail": "new@example.com",
  "otp": "123456"
}
```

## POST /api/v1/auth/refresh

- Auth: Public
- Mo ta: Tao access token moi tu `refresh_token` cookie.

### Loi thuong gap

- `401 Unauthorized`: thieu cookie hoac refresh token het han/khong hop le.

## GET /api/v1/auth/google/login

- Auth: Public
- Guard: `GoogleAuthGuard`
- Mo ta: Redirect trinh duyet sang Google OAuth.

## GET /api/v1/auth/google/callback

- Auth: Public
- Guard: `GoogleAuthGuard`
- Mo ta: Nhan callback tu Google, dang nhap user va redirect ve frontend.

## Ghi chu

- Validation pipe dang bat `whitelist` va `forbidNonWhitelisted`.
- Endpoint auth public van co response wrapper neu controller tra JSON thay vi redirect.
