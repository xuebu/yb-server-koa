import * as jwt from 'jsonwebtoken';
import * as util from 'util';
import * as bcrypt from 'bcryptjs';
import docrypt from '../utils/crypt';
import statusCode from '../utils/statusCode';

import { updateUserById, getUserById, createUser, getUserByMobile, updateUserPassword } from '../services/UserService';

const verify = util.promisify(jwt.verify);

export default class UserController {
  public static async updateUserById (ctx) {
    const { id } = ctx.params;
    const reqData: object = ctx.request.body;
    if (!id) {
      ctx.response.status = 200;
      ctx.body = statusCode.ERROR_PARAMETER('更新失败: 参数错误');
    } else {
      try {
        await updateUserById(id, reqData);
        ctx.response.status = 200;
        ctx.body = statusCode.SUCCESS('更新成功');
      } catch (err) {
        ctx.response.status = 200;
        ctx.body = statusCode.ERROR_SYSTEM('更新失败：服务器内部错误！');
      }
    }
  }

  public static async getUserById (ctx) {
    const { id } = ctx.params;
    if (!id) {
      ctx.response.status = 200;
      ctx.body = statusCode.ERROR_PARAMETER('查询失败: 参数错误');
    } else {
      try {
        const user = await getUserById(id);
        ctx.response.status = 200;
        ctx.body = statusCode.SUCCESS('查询成功', user);
      } catch (err) {
        ctx.response.status = 200;
        ctx.body = statusCode.ERROR_SYSTEM('查询失败：服务器内部错误！');
      }
    }
  }

  public static async register (ctx) {
    const reqData = ctx.request.body;
    const { mobile, password } = reqData;

    if (mobile && password) {
      try {
        const existUser = await getUserByMobile(mobile);
        if (existUser) {
          ctx.response.status = 200;
          ctx.body = statusCode.ERROR_EXISTED('用户已经存在');
        } else {
          reqData.password = docrypt(password);
          if (!reqData.hasOwnProperty('role')) { // 如果没有传入role，则默认为游客，后期管理员可以改变角色
            reqData.role = 4;
          }
          const newUser = await createUser(reqData);
          if (!newUser) {
            ctx.response.status = 200;
            ctx.body = statusCode.ERROR_SQL('创建失败: 访问数据库异常！');
          } else {
            const user = await getUserByMobile(newUser.mobile);
            const { id, name, mobile, role, profilePhoto, birthday, sex, address, } = user;
            const userInfo: object = {
              id, name, mobile, role, profilePhoto, birthday, sex, address,
            };
            const token = jwt.sign({ mobile, id }, 'jwtSecret', { expiresIn: '24h' });
            ctx.response.status = 200;
            ctx.body = statusCode.SUCCESS('创建用户成功', { token, userInfo });
          }
        }
      } catch (err) {
        ctx.response.status = 200;
        ctx.body = statusCode.ERROR_SYSTEM('创建失败：服务器内部错误！');
      }
    } else {
      ctx.response.status = 200;
      ctx.body = statusCode.ERROR_PARAMETER('创建失败: 参数错误');
    }
  }

  public static async login (ctx) {
    const reqData = ctx.request.body;
    const { mobile, password } = reqData;

    if (mobile && password) {
      try {
        const existUser = await getUserByMobile(mobile);
        if (!existUser) {
          ctx.response.status = 200;
          ctx.body = statusCode.ERROR_EXISTED('用户不存在');
        } else {
          const { id, name, role, profilePhoto, birthday, sex, address } = existUser;
          if (bcrypt.compareSync(password, existUser.password)) {
            const token: string = jwt.sign({ mobile, id }, 'jwtSecret', { expiresIn: '24h' });
            const userInfo: object = {
              id, name, mobile, role, profilePhoto, birthday, sex, address,
            };
            ctx.response.status = 200;
            ctx.body = statusCode.SUCCESS('登录成功', { token, userInfo });
          } else {
            ctx.response.status = 200;
            ctx.body = statusCode.ERROR_LOGIN('登录失败：用户名或密码错误');
          }
        }
      } catch (err) {
        ctx.response.status = 200;
        ctx.body = statusCode.ERROR_SYSTEM('登录失败：服务器内部错误！');
      }
    } else {
      ctx.response.status = 200;
      ctx.body = statusCode.ERROR_PARAMETER('登录失败: 参数错误');
    }
  }
  
  public static async updateUserPassword (ctx) {
    const token = ctx.header.authorization;
    const data = ctx.request.body;
    const { id } = ctx.params;

    if (id) {
      try {
        const payload = await verify(token.split(' ')[1], 'jwtSecret');
        const user = await getUserByMobile(payload.mobile);
        if (bcrypt.compareSync(data.oldPassword, user.password)) {
          const password = docrypt(data.password);
          // 只更新密码时不传手机号码, 和修改手机号复用了
          await updateUserPassword(id, password);
          ctx.response.status = 200;
          ctx.body = statusCode.SUCCESS('修改成功');
        } else {
          ctx.response.status = 200;
          ctx.body = statusCode.ERROR_PARAMETER('原密码错误，请重新输入！');
        }
      } catch (err) {
        ctx.response.status = 200;
        ctx.body = statusCode.ERROR_SYSTEM('修改失败，服务器内部错误！');
      }
    } else {
      ctx.response.status = 200;
      ctx.body = statusCode.ERROR_PARAMETER('有信息为空，请输入！');
    }
  }
}
