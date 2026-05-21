import { Injectable } from '@nestjs/common';
import { PureAbility, AbilityBuilder } from '@casl/ability';
import { PrismaQuery, Subjects, createPrismaAbility } from '@casl/prisma';
import { Action } from '../../shared/enums/action.enum';
import { UserInterface } from 'src/shared/interfaces/users.interface';


// Định nghĩa các entities từ Prisma models
export type AppSubjects = Subjects<{
    
}> | 'all';

// Khởi tạo AppAbility kiểu PureAbility có hỗ trợ PrismaQuery
export type AppAbility = PureAbility<[Action, AppSubjects], PrismaQuery>;

@Injectable()
export class CaslAbilityFactory {
    createForUser(user: UserInterface) {
        const { build } = new AbilityBuilder<AppAbility>(createPrismaAbility);
        return build();
    }
}
