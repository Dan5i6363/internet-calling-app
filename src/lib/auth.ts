const { hashPassword, verifyPassword, createToken, verifyToken, JWT_SECRET } = require('../../server/auth.js');

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
}

export { hashPassword, verifyPassword, createToken, verifyToken, JWT_SECRET };
