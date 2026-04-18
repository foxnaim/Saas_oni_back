import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty } from 'class-validator';

export class StatsParamDto {
  @ApiProperty({
    description: 'Company MongoDB ObjectId',
    example: '665f1b2c3d4e5f6a7b8c9d0e',
  })
  @IsNotEmpty()
  @IsMongoId({ message: 'id must be a valid MongoDB ObjectId' })
  id: string;
}
