import { ErrorCatalog } from '../errors/errorCatalog.js';

export function createError(type) {
  const error = new Error();
  error.type = type;
  return error;
}

export { ErrorCatalog };