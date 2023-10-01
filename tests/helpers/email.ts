import { EmailClient } from "../../src/emails";
import { SendMailOptions } from "nodemailer";
import { createStubInstance } from "sinon";

export const mockEmailClient = createStubInstance(EmailClient);

export function mockSend(dto: SendMailOptions) {
  return mockEmailClient.send.withArgs(dto).resolves();
}
