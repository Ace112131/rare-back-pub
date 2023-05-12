const _ = require('lodash');

const getS3Url = (fileName) => {
  if (!fileName) return null;
  return `https://s3.ca-central-1.amazonaws.com/rare.s3/${fileName}`;
};

const getFileType = (contentType) => {
  const fileTypes = {
    "application/pdf": "pdf",
    "image/jpeg": "jpeg",
    "video/mp4": "mp4",
    "image/png": "png",
    "application/postscript": "eps",
  };
  return fileTypes[contentType] || "";
};

const getDaySuffix = (day) => {
  switch (day) {
    case 1:
    case 21:
    case 31:
      return "st";
    case 2:
    case 22:
      return "nd";
    case 3:
    case 23:
      return "rd";
    default:
      return "th";
  }
};

const unindent = (literals, ...tags) => {
  const str = literals[0] + tags
    .map((tag, idx) => tag + literals[idx + 1])
    .join('');

  const lines = str.split('\n');
  if (lines.length <= 1) {
    return str.trimStart();
  }

  const taggedIndents = _.dropWhile(lines, line => line === '')
    .map(line => {
      // find first non-whitespace char
      const startIdx = line.search(/\S/);
      // idx of -1 = no match, i.e. blank line
      return [line, startIdx < 0 ? Infinity : startIdx];
    })

  const [_val, baseIndent] = _.minBy(taggedIndents, ([_val, idx]) => idx) ?? [];

  if (baseIndent === Infinity || baseIndent === undefined) {
    return '';
  } 

  return taggedIndents
    .map(([line, _startIdx]) => line.slice(baseIndent))
    .join('\n');
};

module.exports = {
  getS3Url,
  getFileType,
  getDaySuffix,
  unindent,
};
