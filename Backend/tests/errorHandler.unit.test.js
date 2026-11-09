const { test } = require("node:test");
const assert = require("node:assert/strict");
const multer = require("multer");
const errorHandler = require("../src/middlewares/errorHandler");
const { MAX_IMAGE_SIZE } = require("../src/middlewares/upload.middleware");

const fakeRes = () => {
  const res = { headersSent: false };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

test("The file-size-limit error message matches the actual configured upload limit", () => {
  const error = new multer.MulterError("LIMIT_FILE_SIZE");
  const res = fakeRes();
  errorHandler(error, {}, res, () => {});
  assert.equal(res.statusCode, 400);
  const expectedMb = MAX_IMAGE_SIZE / (1024 * 1024);
  assert.match(res.body.message, new RegExp(`${expectedMb}\\s*MB`));
});
