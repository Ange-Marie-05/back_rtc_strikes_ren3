import { createError } from '../utils/errors.js';

function isAuthenticated(req,res,next) {
    try {
        if (req.session && req.session.userId) {
            return next();
        }
        throw createError("USER_NOT_AUTHENTICATED");
    } catch (error) {
        next(error);
    }
}

export default isAuthenticated;