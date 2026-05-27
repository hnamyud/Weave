import { Controller, Get, Patch, Delete, Param, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { GetUser, ResponseMessage } from '../../common/decorators/customize.decorator';
import { UserInterface } from '../../shared/interfaces/users.interface';
import { ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { UpdateUserDto } from './dto/update-user.dto';
import { RequireUserPermission } from '../../common/decorators/policy.decorator';
import { Action } from '../../shared/enums/action.enum';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('/me')
  @RequireUserPermission(Action.Read)
  @ApiBearerAuth('access-token')
  @ResponseMessage('Get my profile successfully!')
  async getMyProfile(
    @GetUser() user: UserInterface,
  ) {
    return this.usersService.getMyProfile(user.id);
  }

  @Get('/:id')
  @RequireUserPermission(Action.Read)
  @ApiBearerAuth('access-token')
  @ResponseMessage('Get user profile successfully!')
  async getUserProfile(
    @Param('id') userId: string,
  ) {
    return this.usersService.getUserProfile(userId);
  }

  @Patch('/me')
  @RequireUserPermission(Action.Update)
  @ApiBearerAuth('access-token')
  @ResponseMessage('Update my profile successfully!')
  @ApiBody({ type: UpdateUserDto })
  async updateMyProfile(
    @GetUser() user: UserInterface,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateMyProfile(dto, user.id);
  }

  @Delete('/me')
  @RequireUserPermission(Action.Delete)
  @ApiBearerAuth('access-token')
  @ResponseMessage('Delete account successfully!')
  async deleteMyAccount(
    @GetUser() user: UserInterface,
  ) {
    return this.usersService.softDeleteUser(user.id);
  }
}
