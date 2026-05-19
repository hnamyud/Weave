import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional } from "class-validator";

export class CreateUserDto {
    @ApiProperty()
    @IsNotEmpty({ message: 'Username cannot be empty' })
    username: string;

    @ApiProperty()
    @IsEmail({}, {message: 'Email is not valid'})
    @IsNotEmpty({ message: 'Email cannot be empty' })
    email: string;

    @ApiProperty()
    @IsNotEmpty({ message: 'Password cannot be empty' })
    password: string;

    @ApiProperty()
    @IsNotEmpty({ message: 'DisplayName cannot be empty' })
    displayName: string;
}

export class RegisterUserDto {
    @ApiProperty()
    @IsNotEmpty({ message: 'Username cannot be empty' })
    username: string;

    @ApiProperty()
    @IsEmail({}, {message: 'Email is not valid'})
    @IsNotEmpty({ message: 'Email cannot be empty' })
    email: string;

    @ApiProperty()
    @IsNotEmpty({ message: 'Password cannot be empty' })
    password: string;

    @ApiProperty()
    @IsNotEmpty({ message: 'DisplayName cannot be empty' })
    displayName: string;
}