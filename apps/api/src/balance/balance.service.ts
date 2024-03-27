import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListQueryParams, ListResponse } from 'src/shared/models';
import { CreateBalanceDto } from './dto/create-balance.dto';
import { UpdateBalanceDto } from './dto/update-balance.dto';
import { Balance } from './entities/balance.entity';
import { BalanceView } from './models/BalanceView';

@Injectable()
export class BalanceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createBalanceDto: CreateBalanceDto) {
    const balance = await this.prisma.balance.create({
      data: {
        ...createBalanceDto,
        id: randomUUID(),
        userId,
        remainingValue: createBalanceDto.initialValue,
      },
    });

    return this.renderView(balance);
  }

  async findAll(
    queryParams: ListQueryParams = {
      page: 1,
      size: 15,
    },
  ): Promise<ListResponse<BalanceView>> {
    const take = queryParams.size;
    const skip = queryParams.size * (queryParams.page - 1);

    const balances = await this.prisma.balance.findMany({
      where: {
        name: {
          contains: queryParams?.query,
        },
      },
      take,
      skip,
    });

    const total = await this.prisma.balance.count({
      where: {
        name: {
          contains: queryParams?.query,
        },
      },
    });

    return {
      items: balances.map((balance) => this.renderView(balance)),
      total,
    };
  }

  async findOne(id: string) {
    const balance = await this.prisma.balance.findUnique({ where: { id } });

    return this.renderView(balance);
  }

  async update(id: string, updateBalanceDto: UpdateBalanceDto) {
    const balance = await this.prisma.balance.update({
      data: updateBalanceDto,
      where: {
        id,
      },
    });

    return this.renderView(balance);
  }

  async remove(id: string) {
    const vinculedPayment = await this.prisma.payment.findFirst({
      where: {
        balanceId: id,
      },
    });

    if (vinculedPayment)
      throw new HttpException(
        {
          status: HttpStatus.CONFLICT,
          error: 'This user is already linked with a payment',
        },
        HttpStatus.CONFLICT,
      );

    await this.prisma.balance.delete({ where: { id } });
  }

  private calculateUsedValue(initialValue: number, remainingValue: number) {
    return initialValue - remainingValue;
  }

  private renderView(balance: Balance): BalanceView {
    return {
      id: balance.id,
      name: balance.name,
      description: balance.description,
      initialValue: balance.initialValue,
      remainingValue: balance.remainingValue,
      usedValue: this.calculateUsedValue(
        balance.initialValue,
        balance.remainingValue,
      ),
    };
  }
}
