const crypto = require('crypto');
if (!crypto.hash) {
  crypto.hash = function(algorithm, data, outputFormat) {
    const hash = crypto.createHash(algorithm);
    hash.update(data);
    return outputFormat ? hash.digest(outputFormat) : hash.digest();
  };
}
