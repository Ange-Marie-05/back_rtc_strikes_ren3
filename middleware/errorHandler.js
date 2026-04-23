import { ErrorCatalog } from '../errors/errorCatalog.js';

function errorHandler(err, req, res, next) {
  // Cherche dans le catalogue
  const errorInfo = ErrorCatalog[err.type];
  
  if (errorInfo) {
    console.error(err);
    return res.status(errorInfo.code).json({
      success: false,
      message: errorInfo.message
    });
  }
  
  // Erreur non cataloguée (fallback)
  console.error(err);
  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur / Internal Server Error'
  });
}

export default errorHandler;