import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateWorkspaceMembersDto } from './dto/create-wm.dto';
import { v7 as uuidv7 } from 'uuid';
import { WorkspaceRole } from '@prisma/client';
import { parsePositiveInteger } from '../../common/utils/parse-interger.utils';

@Injectable()
export class WorkspaceMembersService {
    constructor(
        private prisma: PrismaService,
    ) { }

    // Create workspace for owner
    async createWorkspaceOwner(dto: CreateWorkspaceMembersDto) {
        return this.createMember(dto, WorkspaceRole.OWNER);
    }

    async createWorkspaceMembers(dto: CreateWorkspaceMembersDto) {
        return this.createMember(dto, WorkspaceRole.MEMBER);
    }

    async getWorkspaceMembers(currentPage: number, limit: number, workspaceId: string) {
        const page = parsePositiveInteger(currentPage, 1, 'currentPage');
        const pageSize = parsePositiveInteger(limit, 10, 'limit');
        const offset = (page - 1) * pageSize;

        const where = {
            workspaceId: workspaceId,
            workspace: {
                isDeleted: false,
            },
            leftAt: null,
        };

        const totalItems = await this.prisma.workspaceMember.count({
            where
        });
        const totalPages = Math.ceil(totalItems / pageSize);
        const result = await this.prisma.workspaceMember.findMany({
            where,
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

    async grantWorkspaceRole(workspaceId: string, userId: string, role: WorkspaceRole) {
        const member = await this.prisma.workspaceMember.findFirst({
            where: {
                workspaceId,
                userId,
                leftAt: null,
                workspace: {
                    isDeleted: false,
                },
            }
        });

        if (!member) {
            throw new BadRequestException('User is not an active member of this workspace');
        }

        return this.prisma.workspaceMember.update({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                }
            },
            data: {
                role,
            }
        });
    }

    // Xong conversation thì quay lại
    async kickMember(workspaceId: string, userId: string) {
        
    }

    private isPrismaError(error: unknown, code: string) {
        return typeof error === 'object'
            && error !== null
            && 'code' in error
            && error.code === code;
    }
}
