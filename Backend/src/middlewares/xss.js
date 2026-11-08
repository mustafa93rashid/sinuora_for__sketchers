// Input validation belongs to each route. Preserve passwords, tokens and text
// exactly; HTML must be escaped at its output context (as email templates do).
module.exports = (req, res, next) => next();
