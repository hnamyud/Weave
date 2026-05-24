import { Test, TestingModule } from '@nestjs/testing';
import { ConversationMembersController } from './conversation_members.controller';
import { ConversationMembersService } from './conversation_members.service';

describe('ConversationMembersController', () => {
  let controller: ConversationMembersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationMembersController],
      providers: [ConversationMembersService],
    }).compile();

    controller = module.get<ConversationMembersController>(ConversationMembersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
