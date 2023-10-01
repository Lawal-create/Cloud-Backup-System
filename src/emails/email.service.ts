import { inject, injectable } from "inversify";

import APP_TYPES from "@app/config/types";
import { EmailClient } from "./email.client";
import { ForgotPasswordDTO } from "@app/users";
import { SendMailOptions } from "nodemailer";

@injectable()
export class EmailService {
  @inject(APP_TYPES.EmailClient) private client: EmailClient;

  async sendForgotPasswordEmail(message: string, user: ForgotPasswordDTO) {
    return await this.send({
      from: "lawizyhal@gmail.com",
      subject: "Reset your password",
      to: user.email,
      text: message,
    });
  }

  private async send(options: SendMailOptions): Promise<void> {
    await this.client.send(options);
  }
}
