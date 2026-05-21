import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TokensService } from './tokens.service';

@Injectable()
export class TokensScheduler {
    private readonly logger = new Logger(TokensScheduler.name);

    constructor(private readonly tokensService: TokensService) { }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async cleanupInactiveRefreshTokens() {
        const result = await this.tokensService.cleanupInactiveRefreshTokens();

        if (result.count > 0) {
            this.logger.log(`Cleaned up ${result.count} inactive refresh token(s)`);
        }
    }
}
