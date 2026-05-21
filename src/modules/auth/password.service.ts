import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { UsersService } from "../users/users.service";
import Redis from 'ioredis';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class PasswordService {
    constructor(
        private userService: UsersService,
        @Inject('REDIS_CLIENT') private redisClient: Redis
    ) { }

    async verifyOtp(email: string, otp: string) {
        const redisKey = `reset_otp:${email}`;
        const attemptsKey = `reset_otp_attempts:${email}`;
        const attempts = await this.redisClient.get(attemptsKey);

        // Check number of attempts
        if (attempts && parseInt(attempts) >= 5) {
            await this.redisClient.del(redisKey); // Delete OTP from Redis
            await this.redisClient.del(attemptsKey);
            throw new BadRequestException('You have entered the wrong OTP too many times! Please request a new OTP.');
        }

        const storedOtp = await this.redisClient.get(redisKey);
        if (!storedOtp) {
            throw new BadRequestException('OTP is invalid or has expired!');
        }
        if (storedOtp !== otp) {
            // Increase number of attempts
            await this.redisClient.incr(attemptsKey);

            // Set time to live for this key (example 5 minutes = equal to OTP time)
            await this.redisClient.expire(attemptsKey, 300);
            throw new BadRequestException('OTP is invalid!');
        }

        // If correct, delete the key count (so that the next time the user resets, they don't get stuck with the old limit)
        await this.redisClient.del(attemptsKey);
        return true;
    }

    async resetPassword(resetPasswordDto: ResetPasswordDto) {
        // Kiểm tra OTP và limit thử
        await this.verifyOtp(resetPasswordDto.email, resetPasswordDto.otp);

        const redisKey = `reset_otp:${resetPasswordDto.email}`;

        const user = await this.userService.findOneByEmail(resetPasswordDto.email);
        if (!user) {
            // Case hiếm: Có OTP trong Redis nhưng User lại bị xóa khỏi DB rồi
            throw new BadRequestException('Account not found!');
        }
        await this.userService.updateUserPassword(resetPasswordDto.email, resetPasswordDto.newPassword);
        // Xoá OTP sau khi đổi mật khẩu thành công
        await this.redisClient.del(redisKey);
    }

    async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
        const isValid = changePasswordDto.newPassword === changePasswordDto.confirmPassword;
        if (!isValid) {
            throw new BadRequestException('New password confirmation does not match!');
        }

        const user = await this.userService.findOneById(userId);
        if (!user) {
            throw new BadRequestException(`User: ${userId} does not exist`);
        }

        if (!user.password) {
            throw new BadRequestException(
                'Your account is registered via Google OAuth, you can set up a password in your profile settings to enable local login and password change features.',
            );
        }

        const isMatch = await this.userService.isValidPassword(changePasswordDto.oldPassword, user.password);
        if (!isMatch) {
            throw new BadRequestException('Old password is incorrect');
        }

        const isSamePassword = await this.userService.isValidPassword(changePasswordDto.newPassword, user.password);
        if (isSamePassword) {
            throw new BadRequestException('New password cannot be the same as the old password');
        }

        await this.userService.updateUserPasswordById(user.id, changePasswordDto.newPassword);

        return {
            id: user.id,
            email: user.email,
        };
    }
}
