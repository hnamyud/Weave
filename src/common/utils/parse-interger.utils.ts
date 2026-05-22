import { BadRequestException } from '@nestjs/common';

export function parsePositiveInteger(
    value: unknown,
    defaultValue: number,
    fieldName: string,
): number {
    const parsed =
        value === undefined || value === null
            ? defaultValue
            : Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new BadRequestException(
            `${fieldName} must be a positive integer`,
        );
    }

    return parsed;
}