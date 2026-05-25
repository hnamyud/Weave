import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDate, IsEmail, IsNotEmpty } from "class-validator";

export class CreateInviteLinkDto {
    @ApiProperty()
    @IsNotEmpty({ message: "Expiration date cannot be empty" })
    @Type(() => Date)
    @IsDate()
    expiresAt: Date
}  

export class CreateDirectInviteDto {
    @ApiProperty()
    @IsNotEmpty({ message: "Invited email cannot be empty" })
    @IsEmail({}, { message: "Invited email must be valid" })
    invitedEmail: string
}
