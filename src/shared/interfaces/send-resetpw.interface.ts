export interface SendResetPasswordJobData {
  email: string;
  subject: string;
  otp: string;
}