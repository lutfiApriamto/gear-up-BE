// ./middlewares/parsePagination.js

export const parsePagination = (req, res, next) => {
  let { page = 1, limit = 10 } = req.query;

  page = parseInt(page, 10);
  limit = parseInt(limit, 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 10;

  const skip = (page - 1) * limit;

  req.pagination = { page, limit, skip };

  next();
};