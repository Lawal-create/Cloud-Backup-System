import { File, FileDTO, FileQuery } from "./file.model";
import { PaginatedResult, Repository } from "@app/internal/postgres";
import { isEmpty, omit } from "lodash";

export class FileRepository extends Repository<File> {
  private db = this.setup("files");

  async create(dto: FileDTO): Promise<File> {
    const [file] = await this.db().insert(dto, "*");

    return file;
  }

  async getById(id: string, ownerID: string): Promise<File> {
    return await this.db()
      .where("id", id)
      .andWhere("owner_id", ownerID)
      .first();
  }

  async list(query?: FileQuery): Promise<File[] | PaginatedResult<File>> {
    let db = isEmpty(query)
      ? this.db()
      : this.db().where(
          omit(query, ["limit", "offset", "nopaginate", "order_by", "order"])
        );

    db = db.orderBy(query.order_by, query.order);

    if (query.nopaginate) {
      return await db;
    }

    return await this.paginated(db, query.limit, query.offset);
  }

  async deleteFile(id: string) {
    await this.db().where("id", id).delete();
  }
}
