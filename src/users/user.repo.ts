import { User, UserDTO } from "./user.model";

import { Repository } from "@app/internal/postgres";
import { validate } from "uuid";

export class DuplicateUser extends Error {
  constructor() {
    super("You've already registerd this email");
  }
}

export class UserRepository extends Repository<User> {
  private db = this.setup("users", "password_hash");

  async create(dto: UserDTO): Promise<User> {
    try {
      const [user] = await this.db().insert(dto, "*");

      return user;
    } catch (err) {
      //db error for duplicate of unique constraints
      if (err.code === "23505") {
        throw new DuplicateUser();
      }
      throw err;
    }
  }

  async getById(id: string): Promise<User | undefined> {
    let db = this.db();

    if (validate(id)) {
      db = db.where("id", id);
    } else {
      db = db.whereLike("email", `%${id}%`).orWhereLike("phone", `%${id}%`);
    }

    return await db.first();
  }

  async updatePassword(id: string, hash: string): Promise<User> {
    const bytes = Buffer.from(hash);

    const [user] = await this.db()
      .where("id", id)
      .update({ password_hash: bytes }, "*");

    return user;
  }

  async getByEmail(email: string): Promise<User | undefined> {
    return await this.db().where("email", email).first();
  }
}
