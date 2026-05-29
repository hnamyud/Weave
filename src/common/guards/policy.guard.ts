import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from '../casl/ability.factory';
import { IS_PUBLIC_KEY } from '../decorators/customize.decorator';
import {
  CHECK_POLICIES_KEY,
  PolicyHandler,
  PolicyHandlerCallback,
  PolicyRequest,
} from '../decorators/policy.decorator';
import { UserInterface } from 'src/shared/interfaces/users.interface';

type PolicyGuardRequest = PolicyRequest & {
  user: UserInterface;
};

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return Promise.resolve(true);
    }

    const policyHandlers =
      this.reflector.get<PolicyHandler[]>(
        CHECK_POLICIES_KEY,
        context.getHandler(),
      ) || [];

    // Nếu không định nghĩa policy nào thì coi như đi qua
    if (policyHandlers.length === 0) {
      return Promise.resolve(true);
    }

    const request = context.switchToHttp().getRequest<PolicyGuardRequest>();
    const user = request.user;

    // Tạo ability cho user đang gọi API
    const ability = this.caslAbilityFactory.createForUser(
      user,
      request as Parameters<CaslAbilityFactory['createForUser']>[1],
    );

    // Kiểm tra tất cả các handler được khai báo trong decorator
    for (const handler of policyHandlers) {
      let isAllowed = false;
      let message = 'Bạn không có quyền thực hiện hành động này!';
      if (this.isPolicyHandlerCallback(handler)) {
        isAllowed = handler(ability, request);
      } else {
        isAllowed = handler.handle(ability, request);
        message = handler.message || message;
      }

      if (!isAllowed) {
        return Promise.reject(new ForbiddenException(message));
      }
    }

    return Promise.resolve(true);
  }

  private isPolicyHandlerCallback(
    handler: PolicyHandler,
  ): handler is PolicyHandlerCallback {
    return typeof handler === 'function';
  }
}
