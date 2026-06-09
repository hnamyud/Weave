# Mailer Module

Controller prefix: `/api/v1/mail`

## POST /api/v1/mail/reset-password

- Auth: Public
- Throttle: tối đa 1 request / 60 giây theo rule `short`
- Mô tả: Gửi mã OTP reset password qua email.

### Body

```json
{
  "email": "john@example.com"
}
```

### Response

```json
{
  "statusCode": 201,
  "message": "Reset password code has sent!",
  "data": {}
}
```
