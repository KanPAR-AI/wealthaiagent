// Mock for nanoid
let counter = 0;

// Generate a random alphanumeric string of specified length
function generateId(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

module.exports = {
  nanoid: (length = 21) => {
    counter++;
    // Return just the alphanumeric string without prefix
    return generateId(length);
  }
}; 