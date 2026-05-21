import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateWorkspaceMembersDto } from './dto/create-wm.dto';
import { v7 as uuidv7 } from 'uuid';
import { WorkspaceRole } from '@prisma/client';

@Injectable()
export class WorkspaceMembersService {
    constructor(
        private prisma: PrismaService,
    ) { }

    // First create workspace for owner
    async createWorkspaceOwner(dto: CreateWorkspaceMembersDto) {
        return this.createMember(dto, WorkspaceRole.OWNER);
    }

    async createWorkspaceMembers(dto: CreateWorkspaceMembersDto) {
        return this.createMember(dto, WorkspaceRole.MEMBER);
    }

    async getWorkspaceMembers(currentPage: number, limit: number, workspaceId: string) {
        const page = this.parsePositiveInteger(currentPage, 1, 'currentPage');
        const pageSize = this.parsePositiveInteger(limit, 10, 'limit');
        const offset = (page - 1) * pageSize;

        const totalItems = await this.prisma.workspaceMember.count({
            where: { workspaceId: workspaceId }
        });
        const totalPages = Math.ceil(totalItems / pageSize);
        const result = await this.prisma.workspaceMember.findMany({
            where: { workspaceId: workspaceId },
            skip: offset,
            take: pageSize,
            orderBy: { joinedAt: 'desc' },
            select: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,  
                    }
                },
                role: true,
                joinedAt: true,
            }
        });

        return { 
            meta: {
                current: page, // trang hiện tại
                pageSize: pageSize, // số lượng bản ghi đã lấy
                pages: totalPages,  // tổng số trang
                total: totalItems // tổng số phần tử
            },
            result
        };
    }

    private async createMember(dto: CreateWorkspaceMembersDto, role: WorkspaceRole) {
        try {
            return await this.prisma.workspaceMember.create({
                data: {
                    id: uuidv7(),
                    workspaceId: dto.workspaceId,
                    userId: dto.userId,
                    role,
                },
            });
        } catch (error) {
            // Prisma error code: P2002 - Unique constraint failed, P2003 - Foreign key constraint failed
            if (this.isPrismaError(error, 'P2002')) {
                throw new ConflictException('User is already a member of this workspace');
            }
            if (this.isPrismaError(error, 'P2003')) {
                throw new BadRequestException('Workspace or user does not exist');
            }
            throw error;
        }
    }

    private parsePositiveInteger(value: number, defaultValue: number, fieldName: string) {
        const parsedValue = value === undefined || value === null ? defaultValue : Number(value);

        if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
            throw new BadRequestException(`${fieldName} must be a positive integer`);
        }

        return parsedValue;
    }

    private isPrismaError(error: unknown, code: string) {
        return typeof error === 'object'
            && error !== null
            && 'code' in error
            && error.code === code;
    }
}
