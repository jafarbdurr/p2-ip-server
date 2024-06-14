const { verifyToken } = require("../helpers/jwt")
const { User } = require('../models')

async function authentication(req, res, next) {
  try {
    let token = req.headers.authorization
    // console.log(token);
    if (!token) {
      throw { name: 'InvalidToken' }
    }
    if (token.slice(0, 7) !== 'Bearer ') {
      throw { name: 'InvalidToken' }
    }
    token = token.slice(7)
    let payload = verifyToken(token)
    if (!payload) {
      throw { name: 'InvalidToken' }
    }
    // console.log(payload.id);
    // console.log('hehehe');
    let user = await User.findByPk(payload.id)
    // console.log(user);
    if (!user) {
      throw { name: 'InvalidToken' }
    }
    req.user = {
      id: user.id,
      role: user.role,
      status : user.status
    }
    // console.log(req.user);
    next()
  } catch (error) {
    // console.log(error);
    next(error)
  }
}
module.exports = authentication