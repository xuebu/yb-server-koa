import * as jwt from 'jsonwebtoken';
import * as util from 'util';

const verify = util.promisify(jwt.verify);

const token = () => async (ctx, next) => {
  try {
    const token = ctx.header.authorization;
    if (token) {
      const tk = token.split(' ')[1];
      let payload;
      try {
        payload = await verify(tk, 'jwtSecret');
        ctx.user = {
          name: payload.name,
          id: payload.id,
        };
      } catch (err) {
        err.status = 200;
        ctx.body = '权限认证失败，请重新登录！';
      }
    }
    await next();
  } catch (err) {
    if (err.status === 401) {
      ctx.status = 401;
      ctx.body = '权限认证失败，请重新登录！';
    } else {
      err.status = 404;
      ctx.body = '权限认证失败，请重新登录！';
    }
  }
};

export { token };