import { spawn } from 'node:child_process';

export class Message {
  execQuery = async query => {
    return new Promise((resolve, reject) => {
      const cmd = spawn('sqlite3', ['msg.db', '.mode json', query, '.quit']);
      let response = '';

      cmd.stdout.on('data', async buffer => {
        response += '' + buffer;
      });

      cmd.stderr.on('data', data => reject(new Error(`stderr: ${data}`)));

      cmd.on('error', error => reject(error));

      cmd.on('close', code => {
        if (code === 0) {
          try {
            response = JSON.parse(response);
            resolve(response);
          } catch (e) {
            reject(e);
          }
        } else reject(new Error(`child process exited with code: ${code}`));
      });
    });
  };

  find = async params => {
    const where = params?.where;
    const literal = params?.fields ? params?.fields.join(',') : '*';
    const sentence = `SELECT ${literal} FROM message `;

    if (!where) return await this.execQuery(sentence);

    const ANDs = Object.entries(where);
    const andQuery = queryConditions(ANDs, 'AND');

    let query = `${sentence} WHERE ${andQuery}`;

    const ORs = Object.entries(params?.or);
    if (ORs) {
      const orQuery = queryConditions(ORs, 'OR');
      query += ` OR ${orQuery}`;
    }
    console.log(query);
    return await this.execQuery(query);
  };

  update = async params => {
    const where = params?.where;
    const fields = Object.entries(params?.fields);
    if (!where) return { ok: false, error: 'where not specified' };
    if (!fields) return { ok: false, error: 'fields not specified' };

    const sentence = 'UPDATE messages SET ';

    // FIELDS
    let columns = [];

    fields.forEach(e => {
      const [key, value] = e;
      const col = `${key}=${value}`;
      columns.push(col);
    });

    columns = columns.join(',');

    // WHERE
    const ANDs = Object.entries(where);

    // completar condiciones
    const conditions = [];
    const query = queryConditions(ANDs, 'AND');

    return await this.execQuery(`${sentence} WHERE ${query}`);
  };
}

function queryConditions (conditions, logicGate) {
  const query = [];

  conditions.forEach(e => {
    const [key, value] = e;
    const queryContainsNull = typeof value === 'string' && ['is null', 'is not null'].includes(value.toLowerCase());
    const symbol = queryContainsNull ? ' ' : '=';

    const cond = `${key}${symbol}${value}`;
    query.push(cond);
  });

  return query.join(` ${logicGate} `);
}

const m = new Message();

const msg = await m.find({
  where: { reaction: 'is not null', from_me: true },
  or: {
    reply_of: 'is not null'
  }
})
  .catch(error => { return { ok: false, error }; });

console.log({ msg, type: typeof msg });
