const bcrypt = require('bcrypt');
const saltRounds = 8;
const salt = bcrypt.genSaltSync(saltRounds);

function hashPassword(password) {
    return bcrypt.hashSync(password, salt);
}
function comparePassword(password, hash) {
    return bcrypt.compareSync(password, hash)
}

module.exports = {
    hashPassword,
    comparePassword
}